import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { NextRequest } from "next/server"

// In-memory suggestion store (shared with inbound route logic)
// Key: project_id
const mcpSuggestionStore = global as unknown as {
  _mcpStore?: Map<string, Array<{
    id: string
    content: string
    targetFiles: string[]
    summary: string
    source: string
    timestamp: string
    status: "pending" | "accepted" | "rejected"
  }>>
}

if (!mcpSuggestionStore._mcpStore) {
  mcpSuggestionStore._mcpStore = new Map()
}

const store = mcpSuggestionStore._mcpStore

// Fallback file matching patterns
const FILE_PATTERNS: Record<string, string[]> = {
  "DECISIONS": ["decision", "architecture", "choice", "why we", "rationale", "trade-off", "adr", "chose", "selected"],
  "GLOSSARY": ["term", "definition", "meaning", "glossary", "vocabulary", "jargon", "define"],
  "PROJECT": ["project", "overview", "summary", "about", "introduction", "scope", "background", "goal"],
  "ROLES": ["role", "persona", "team", "responsibility", "who", "stakeholder", "owner"],
  "TASKS": ["task", "todo", "action", "sprint", "milestone", "backlog", "ticket", "issue"],
  "DISCOVERY": ["discovery", "research", "finding", "insight", "learned", "user research", "feedback"],
  "OPEN-QUESTIONS": ["question", "unknown", "unclear", "need to", "investigate", "tbd", "hypothesis", "?"],
  "NOTES": ["note", "observation", "thought", "idea", "misc", "fyi", "reminder"],
}

async function fetchContextFilesFromRepo(repo: string, token?: string) {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
    }
    if (token) headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(`https://api.github.com/repos/${repo}/contents/context`, { headers })
    if (!res.ok) return []

    const files: Array<{ name: string; path: string; download_url: string }> = await res.json()
    const mdFiles = files.filter((f) => f.name.endsWith(".md")).slice(0, 10)

    const contents = await Promise.all(
      mdFiles.map(async (f) => {
        try {
          const r = await fetch(f.download_url)
          if (!r.ok) return null
          const text = await r.text()
          return { name: f.name.replace(".md", ""), content: text.slice(0, 1500) }
        } catch {
          return null
        }
      })
    )
    return contents.filter(Boolean) as Array<{ name: string; content: string }>
  } catch {
    return []
  }
}

function matchToFiles(suggestion: string, contextFiles: Array<{ name: string; content: string }>): string[] {
  const lower = suggestion.toLowerCase()

  if (contextFiles.length > 0) {
    const scores = contextFiles.map((f) => {
      let score = 0
      const words = f.content.toLowerCase().split(/\s+/).filter((w) => w.length > 4)
      const unique = [...new Set(words)].slice(0, 50)
      for (const w of unique) {
        if (lower.includes(w)) score++
      }
      if (lower.includes(f.name.toLowerCase())) score += 5
      return { name: f.name, score }
    })
    const matches = scores.filter((s) => s.score > 2).sort((a, b) => b.score - a.score).slice(0, 3)
    if (matches.length > 0) return matches.map((m) => m.name)
  }

  // Fallback static matching
  const scores2: Array<{ file: string; score: number }> = []
  for (const [file, keywords] of Object.entries(FILE_PATTERNS)) {
    const score = keywords.filter((k) => lower.includes(k)).length
    if (score > 0) scores2.push({ file, score })
  }
  scores2.sort((a, b) => b.score - a.score)
  return scores2.length > 0 ? scores2.slice(0, 3).map((s) => s.file) : ["NOTES"]
}

const handler = createMcpHandler(
  (server) => {
    // Tool 1: Submit a suggestion
    server.registerTool(
      "submit_suggestion",
      {
        title: "Submit Suggestion",
        description:
          "Submit a suggestion or proposed change to a CXM project's context files. " +
          "The system will automatically determine which context file(s) the suggestion belongs to " +
          "based on the content. Provide a project_id and the suggestion content.",
        inputSchema: {
          project_id: z.string().describe("The CXM project ID to submit the suggestion to"),
          content: z.string().describe("The suggestion content - what should be added, changed, or noted in the context files"),
          target_files: z
            .array(z.string())
            .optional()
            .describe("Optional: explicit list of context file names to target (e.g. ['DECISIONS', 'GLOSSARY']). If omitted, the system auto-detects."),
          repo: z.string().optional().describe("Optional: GitHub repo (owner/repo) to fetch context from for better file matching"),
          token: z.string().optional().describe("Optional: GitHub token for private repo access"),
        },
      },
      async ({ project_id, content, target_files, repo, token }) => {
        // Determine target files
        let files: string[]
        if (target_files && target_files.length > 0) {
          files = target_files
        } else {
          const contextFiles = repo ? await fetchContextFilesFromRepo(repo, token) : []
          files = matchToFiles(content, contextFiles)
        }

        const suggestion = {
          id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          content,
          targetFiles: files,
          summary: content.split(/[.!?\n]/)[0].trim().slice(0, 120),
          source: "mcp-client",
          timestamp: new Date().toISOString(),
          status: "pending" as const,
        }

        const existing = store.get(project_id) || []
        existing.push(suggestion)
        store.set(project_id, existing)

        return {
          content: [
            {
              type: "text",
              text: `Suggestion submitted successfully.\n\nID: ${suggestion.id}\nTargeted files: ${files.join(", ")}\nSummary: ${suggestion.summary}\n\nThe suggestion is now pending review in the CXM dashboard.`,
            },
          ],
        }
      }
    ),

    // Tool 2: List pending suggestions for a project
    server.registerTool(
      "list_suggestions",
      {
        title: "List Suggestions",
        description: "List all pending suggestions for a CXM project.",
        inputSchema: {
          project_id: z.string().describe("The CXM project ID"),
          status: z
            .enum(["pending", "accepted", "rejected", "all"])
            .optional()
            .describe("Filter by status. Defaults to 'pending'."),
        },
      },
      async ({ project_id, status = "pending" }) => {
        const all = store.get(project_id) || []
        const filtered = status === "all" ? all : all.filter((s) => s.status === status)

        if (filtered.length === 0) {
          return {
            content: [{ type: "text", text: `No ${status} suggestions found for project ${project_id}.` }],
          }
        }

        const text = filtered
          .map((s) => `[${s.id}] ${s.status.toUpperCase()} | Files: ${s.targetFiles.join(", ")}\n  ${s.summary}`)
          .join("\n\n")

        return {
          content: [{ type: "text", text: `${filtered.length} suggestion(s):\n\n${text}` }],
        }
      }
    )
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: false,
  }
)

export { handler as GET, handler as POST }
