import { createMcpHandler } from "mcp-handler"
import { z } from "zod"

// Suggestions storage (in-memory for now)
const suggestions: Array<{
  id: string
  content: string
  targetFile: string
  timestamp: string
}> = []

const handler = createMcpHandler(
  (server) => {
    // Register the submit_suggestion tool
    server.registerTool(
      "submit_suggestion",
      {
        title: "Submit Suggestion",
        description: "Submit a suggestion for a context file. The system will automatically determine which file the suggestion applies to based on the content.",
        inputSchema: {
          content: z.string().describe("The suggestion content to add to a context file"),
          targetFile: z.string().optional().describe("Optional: specific target file (e.g., 'DECISIONS.md', 'OPEN-QUESTIONS.md'). If not provided, the system will auto-detect.")
        }
      },
      async ({ content, targetFile }) => {
        // Auto-detect target file if not provided
        let detectedFile = targetFile
        if (!detectedFile) {
          const contentLower = content.toLowerCase()
          if (contentLower.includes("decision") || contentLower.includes("chose") || contentLower.includes("decided")) {
            detectedFile = "DECISIONS.md"
          } else if (contentLower.includes("question") || contentLower.includes("unclear") || contentLower.includes("?")) {
            detectedFile = "OPEN-QUESTIONS.md"
          } else if (contentLower.includes("task") || contentLower.includes("todo") || contentLower.includes("implement")) {
            detectedFile = "TASKS.md"
          } else if (contentLower.includes("glossary") || contentLower.includes("term") || contentLower.includes("definition")) {
            detectedFile = "GLOSSARY.md"
          } else {
            detectedFile = "NOTES.md"
          }
        }

        // Store suggestion
        const suggestion = {
          id: `sug_${Date.now()}`,
          content,
          targetFile: detectedFile,
          timestamp: new Date().toISOString()
        }
        suggestions.push(suggestion)

        return {
          content: [
            {
              type: "text" as const,
              text: `Suggestion submitted successfully!\n\nTarget file: ${detectedFile}\nSuggestion ID: ${suggestion.id}\n\nThe suggestion has been queued for review in the CXM Context Manager.`
            }
          ]
        }
      }
    )

    // Register the list_context_files tool
    server.registerTool(
      "list_context_files",
      {
        title: "List Context Files",
        description: "List all available context files in the repository",
        inputSchema: {}
      },
      async () => {
        return {
          content: [
            {
              type: "text" as const,
              text: `Available context files:\n\n- DECISIONS.md - Architecture and design decisions\n- OPEN-QUESTIONS.md - Unresolved questions\n- TASKS.md - Implementation tasks\n- GLOSSARY.md - Term definitions\n- NOTES.md - General notes\n- PROJECT.md - Project overview\n- ROLES.md - Team roles`
            }
          ]
        }
      }
    )

    // Register the get_suggestions tool
    server.registerTool(
      "get_suggestions",
      {
        title: "Get Suggestions",
        description: "Get all pending suggestions",
        inputSchema: {}
      },
      async () => {
        if (suggestions.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No pending suggestions."
              }
            ]
          }
        }

        const list = suggestions.map(s => 
          `- [${s.id}] ${s.targetFile}: ${s.content.substring(0, 100)}${s.content.length > 100 ? '...' : ''}`
        ).join('\n')

        return {
          content: [
            {
              type: "text" as const,
              text: `Pending suggestions (${suggestions.length}):\n\n${list}`
            }
          ]
        }
      }
    )
  },
  {
    // Empty middleware config - no auth required
  },
  {
    basePath: "/api/mcp",
    verboseLogs: true,
    // Server metadata with icon
    serverInfo: {
      name: "CXM Context Manager",
      version: "1.0.0",
    }
  }
)

export { handler as GET, handler as POST }
