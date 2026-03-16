import { NextRequest, NextResponse } from "next/server"

/**
 * MCP Inbound API - Receives suggestions from external MCP clients (e.g., Claude)
 * 
 * POST /api/mcp/inbound
 * 
 * The API will:
 * 1. Fetch actual context files from the repository (via GitHub API)
 * 2. Analyze their content to understand what each file covers
 * 3. Match incoming suggestions to the most appropriate file(s)
 * 4. Store it for the project to review
 */

// In-memory store for MCP suggestions (keyed by project ID)
const mcpSuggestionStore = new Map<string, Array<{
  id: string
  content: string
  targetFiles: string[]
  summary: string
  source: string
  timestamp: string
  status: "pending" | "accepted" | "rejected"
}>>()

// Cache for context file metadata (avoid re-fetching on every request)
const contextFileCache = new Map<string, {
  files: Array<{ name: string; path: string; summary: string; keywords: string[] }>
  fetchedAt: number
}>()

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Fallback patterns if we can't fetch real files
const FALLBACK_PATTERNS: Record<string, string[]> = {
  "DECISIONS": ["decision", "architecture", "choice", "why we", "rationale", "trade-off", "tradeoff", "adr"],
  "GLOSSARY": ["term", "definition", "meaning", "glossary", "vocabulary", "jargon", "terminology"],
  "PROJECT": ["project", "overview", "summary", "about", "introduction", "scope", "background"],
  "ROLES": ["role", "persona", "team", "responsibility", "who", "stakeholder"],
  "TASKS": ["task", "todo", "action", "work item", "sprint", "milestone", "backlog"],
  "DISCOVERY": ["discovery", "research", "finding", "insight", "learned", "user research"],
  "NOTES": ["note", "observation", "thought", "idea", "misc", "general"],
  "OPEN-QUESTIONS": ["question", "unknown", "unclear", "need to", "investigate", "tbd", "?", "hypothesis"],
}

/**
 * Fetch context files from GitHub repository
 */
async function fetchContextFiles(repo: string, token?: string): Promise<Array<{ name: string; path: string; content: string }>> {
  try {
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    // Fetch context folder contents
    const listRes = await fetch(`https://api.github.com/repos/${repo}/contents/context`, { headers })
    if (!listRes.ok) {
      console.log("[v0] Could not fetch context folder:", listRes.status)
      return []
    }

    const files: Array<{ name: string; path: string; download_url: string }> = await listRes.json()
    const mdFiles = files.filter(f => f.name.endsWith(".md"))

    // Fetch content for each file (parallel)
    const fileContents = await Promise.all(
      mdFiles.slice(0, 10).map(async (file) => { // Limit to 10 files
        try {
          const contentRes = await fetch(file.download_url)
          if (!contentRes.ok) return null
          const content = await contentRes.text()
          return { name: file.name, path: file.path, content: content.slice(0, 2000) } // First 2000 chars
        } catch {
          return null
        }
      })
    )

    return fileContents.filter((f): f is NonNullable<typeof f> => f !== null)
  } catch (error) {
    console.error("[v0] Error fetching context files:", error)
    return []
  }
}

/**
 * Extract keywords from file content
 */
function extractKeywords(content: string): string[] {
  const words = content.toLowerCase()
    .replace(/[#*`_\[\](){}]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3)
  
  // Count word frequency
  const freq: Record<string, number> = {}
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1
  }
  
  // Return top keywords by frequency
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word)
}

/**
 * Generate a summary from file content
 */
function extractFileSummary(content: string): string {
  // Look for a description after the title
  const lines = content.split("\n").filter(l => l.trim())
  for (let i = 1; i < Math.min(5, lines.length); i++) {
    const line = lines[i].replace(/^[#>*-]+\s*/, "").trim()
    if (line.length > 20 && !line.startsWith("#")) {
      return line.slice(0, 150)
    }
  }
  return lines[0]?.replace(/^#+\s*/, "").slice(0, 150) || "Context file"
}

/**
 * Get or fetch context file metadata with caching
 */
async function getContextFileMetadata(repo: string, token?: string) {
  const cacheKey = repo
  const cached = contextFileCache.get(cacheKey)
  
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.files
  }
  
  const files = await fetchContextFiles(repo, token)
  const metadata = files.map(f => ({
    name: f.name,
    path: f.path,
    summary: extractFileSummary(f.content),
    keywords: extractKeywords(f.content)
  }))
  
  contextFileCache.set(cacheKey, { files: metadata, fetchedAt: Date.now() })
  return metadata
}

/**
 * Match suggestion content to context files using actual file content
 */
function matchSuggestionToFiles(
  content: string, 
  contextFiles: Array<{ name: string; path: string; summary: string; keywords: string[] }>
): string[] {
  const contentLower = content.toLowerCase()
  const contentWords = new Set(contentLower.split(/\s+/).filter(w => w.length > 3))
  
  const scores: Array<{ file: string; score: number }> = []
  
  for (const file of contextFiles) {
    let score = 0
    
    // Check keyword overlap
    for (const keyword of file.keywords) {
      if (contentLower.includes(keyword)) {
        score += 2
      }
    }
    
    // Check file name relevance
    const fileNameBase = file.name.replace(".md", "").toLowerCase()
    if (contentLower.includes(fileNameBase)) {
      score += 5
    }
    
    // Check summary relevance
    const summaryWords = file.summary.toLowerCase().split(/\s+/)
    for (const word of summaryWords) {
      if (word.length > 4 && contentWords.has(word)) {
        score += 1
      }
    }
    
    if (score > 0) {
      scores.push({ file: file.name.replace(".md", ""), score })
    }
  }
  
  // Sort by score and return top matches
  scores.sort((a, b) => b.score - a.score)
  
  // Return top 3 or files with score > 2
  const matches = scores.filter(s => s.score > 2).slice(0, 3).map(s => s.file)
  return matches.length > 0 ? matches : ["NOTES"]
}

/**
 * Fallback matching using static patterns
 */
function detectTargetFilesFallback(content: string): string[] {
  const contentLower = content.toLowerCase()
  const matches: Array<{ file: string; score: number }> = []
  
  for (const [file, keywords] of Object.entries(FALLBACK_PATTERNS)) {
    let score = 0
    for (const keyword of keywords) {
      if (contentLower.includes(keyword)) {
        score++
      }
    }
    if (score > 0) {
      matches.push({ file, score })
    }
  }
  
  matches.sort((a, b) => b.score - a.score)
  const targetFiles = matches.filter(m => m.score > 0).slice(0, 3).map(m => m.file)
  return targetFiles.length > 0 ? targetFiles : ["NOTES"]
}

function generateSummary(content: string): string {
  const firstSentence = content.split(/[.!?]/)[0]
  if (firstSentence.length <= 100) {
    return firstSentence.trim()
  }
  return content.slice(0, 97).trim() + "..."
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { project_id, repo, token, content, source = "mcp-client", target_files } = body
    
    if (!project_id) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 })
    }
    
    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content is required and must be a string" }, { status: 400 })
    }
    
    // Determine target files
    let targetFiles: string[]
    
    if (target_files && Array.isArray(target_files) && target_files.length > 0) {
      // User explicitly specified target files
      targetFiles = target_files
    } else if (repo) {
      // Fetch actual context files from repo and match intelligently
      const contextFiles = await getContextFileMetadata(repo, token)
      if (contextFiles.length > 0) {
        targetFiles = matchSuggestionToFiles(content, contextFiles)
      } else {
        // Fallback to static patterns
        targetFiles = detectTargetFilesFallback(content)
      }
    } else {
      // No repo provided, use fallback
      targetFiles = detectTargetFilesFallback(content)
    }
    
    const suggestion = {
      id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      content,
      targetFiles,
      summary: generateSummary(content),
      source,
      timestamp: new Date().toISOString(),
      status: "pending" as const
    }
    
    // Store suggestion
    const existing = mcpSuggestionStore.get(project_id) || []
    existing.push(suggestion)
    mcpSuggestionStore.set(project_id, existing)
    
    return NextResponse.json({
      success: true,
      suggestion: {
        id: suggestion.id,
        targetFiles: suggestion.targetFiles,
        summary: suggestion.summary
      },
      message: `Suggestion received. Matched to: ${targetFiles.join(", ")}.md`
    })
  } catch (error) {
    console.error("MCP inbound error:", error)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("project_id")
  
  if (!projectId) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 })
  }
  
  const suggestions = mcpSuggestionStore.get(projectId) || []
  const pending = suggestions.filter(s => s.status === "pending")
  
  return NextResponse.json({ 
    suggestions: pending,
    total: suggestions.length,
    pending: pending.length
  })
}

// Export for internal use
export function getMcpInboundSuggestions(projectId: string) {
  return mcpSuggestionStore.get(projectId) || []
}

export function updateMcpSuggestionStatus(projectId: string, suggestionId: string, status: "accepted" | "rejected") {
  const suggestions = mcpSuggestionStore.get(projectId) || []
  const suggestion = suggestions.find(s => s.id === suggestionId)
  if (suggestion) {
    suggestion.status = status
  }
}
