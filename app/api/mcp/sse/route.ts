import { NextRequest } from "next/server"

// Session storage for MCP connections
const sessions: Map<string, { createdAt: number }> = new Map()

// Suggestions storage
const suggestions: Array<{
  id: string
  content: string
  targetFile: string
  timestamp: string
}> = []

// Generate unique session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

// Check if request is an initialize request
function isInitializeRequest(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false
  const obj = body as Record<string, unknown>
  return obj.method === 'initialize'
}

// Create JSON-RPC error response
function createError(id: unknown, code: number, message: string) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message }
  }
}

// Handle MCP protocol methods
function handleMethod(method: string, id: unknown, params: Record<string, unknown> = {}) {
  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: {
            name: "CXM Context Manager",
            version: "1.0.0",
            icon: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-qelcYls92cMMvFuPNbS93BmxVpqJPe.png"
          },
          capabilities: {
            tools: {},
            logging: {}
          }
        }
      }

    case "notifications/initialized":
      // Client acknowledges initialization - no response needed for notifications
      return null

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "submit_suggestion",
              description: "Submit a suggestion for a context file. The system will automatically determine which file the suggestion applies to based on the content.",
              inputSchema: {
                type: "object",
                properties: {
                  content: {
                    type: "string",
                    description: "The suggestion content to add to a context file"
                  },
                  targetFile: {
                    type: "string",
                    description: "Optional: specific target file (e.g., 'DECISIONS.md', 'OPEN-QUESTIONS.md'). If not provided, the system will auto-detect."
                  }
                },
                required: ["content"]
              }
            },
            {
              name: "list_context_files",
              description: "List all available context files in the repository",
              inputSchema: {
                type: "object",
                properties: {}
              }
            }
          ]
        }
      }

    case "tools/call": {
      const toolName = params?.name as string
      const toolArgs = (params?.arguments || {}) as Record<string, unknown>

      if (toolName === "submit_suggestion") {
        const { content, targetFile } = toolArgs as { content: string; targetFile?: string }

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
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `Suggestion submitted successfully!\n\nTarget file: ${detectedFile}\nSuggestion ID: ${suggestion.id}\n\nThe suggestion has been queued for review in the CXM Context Manager.`
              }
            ]
          }
        }
      }

      if (toolName === "list_context_files") {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `Available context files:\n\n- DECISIONS.md - Architecture and design decisions\n- OPEN-QUESTIONS.md - Unresolved questions\n- TASKS.md - Implementation tasks\n- GLOSSARY.md - Term definitions\n- NOTES.md - General notes\n- PROJECT.md - Project overview\n- ROLES.md - Team roles`
              }
            ]
          }
        }
      }

      return createError(id, -32601, `Unknown tool: ${toolName}`)
    }

    default:
      return createError(id, -32601, `Method not found: ${method}`)
  }
}

// GET - Return 405 (no SSE stream) or handle SSE if session exists
export async function GET(req: NextRequest) {
  const sessionId = req.headers.get("mcp-session-id")
  
  // If no session or invalid session, return 405
  if (!sessionId || !sessions.has(sessionId)) {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        "Allow": "POST",
        "Access-Control-Allow-Origin": "*",
      }
    })
  }

  // For valid session, return SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const connectMsg = JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/message",
        params: { level: "info", data: "SSE Connection established" }
      })
      controller.enqueue(encoder.encode(`data: ${connectMsg}\n\n`))

      // Keep alive ping
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          clearInterval(pingInterval)
        }
      }, 30000)

      req.signal.addEventListener("abort", () => {
        clearInterval(pingInterval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "mcp-session-id": sessionId,
    }
  })
}

// POST - Handle all MCP JSON-RPC requests
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sessionId = req.headers.get("mcp-session-id")

    // Handle initialize request - create new session
    if (isInitializeRequest(body) && !sessionId) {
      const newSessionId = generateSessionId()
      sessions.set(newSessionId, { createdAt: Date.now() })

      const response = handleMethod("initialize", body.id, body.params)
      
      return Response.json(response, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "mcp-session-id": newSessionId,
        }
      })
    }

    // For other requests, session should exist (but we're lenient for authless mode)
    const { method, id, params } = body

    // Handle the request
    const response = handleMethod(method, id, params || {})

    // Notifications don't need a response
    if (response === null) {
      return new Response(null, {
        status: 202,
        headers: {
          "Access-Control-Allow-Origin": "*",
          ...(sessionId ? { "mcp-session-id": sessionId } : {}),
        }
      })
    }

    return Response.json(response, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      }
    })
  } catch (error) {
    console.error("[MCP] Error:", error)
    return Response.json(createError(null, -32700, "Parse error"), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      }
    })
  }
}

// DELETE - Terminate session
export async function DELETE(req: NextRequest) {
  const sessionId = req.headers.get("mcp-session-id")
  
  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId)
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
      }
    })
  }

  return new Response("Session not found", {
    status: 404,
    headers: {
      "Access-Control-Allow-Origin": "*",
    }
  })
}

// OPTIONS - CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, mcp-session-id, Accept",
      "Access-Control-Expose-Headers": "mcp-session-id",
    }
  })
}
