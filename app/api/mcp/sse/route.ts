import { NextRequest } from "next/server"

// In-memory storage for suggestions (in production, use a database)
const suggestions: Array<{
  id: string
  content: string
  targetFile: string
  timestamp: string
}> = []

// SSE endpoint for Claude Desktop MCP connection
export async function GET(req: NextRequest) {
  console.log("[MCP SSE] GET request received")
  
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const initMessage = JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {}
      })
      controller.enqueue(encoder.encode(`data: ${initMessage}\n\n`))
      
      // Keep connection alive with periodic pings
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          clearInterval(pingInterval)
        }
      }, 30000)
      
      // Store cleanup function
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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  })
}

// Handle JSON-RPC requests via POST
export async function POST(req: NextRequest) {
  console.log("[MCP SSE] POST request received")
  
  try {
    const body = await req.json()
    console.log("[MCP SSE] Request body:", JSON.stringify(body))
    
    const { method, id, params } = body
    
    // Handle different MCP methods
    switch (method) {
      case "initialize":
        return Response.json({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: {
              name: "CXM Context Manager",
              version: "1.0.0"
            },
            capabilities: {
              tools: {}
            }
          }
        })
        
      case "tools/list":
        return Response.json({
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
        })
        
      case "tools/call":
        const toolName = params?.name
        const toolArgs = params?.arguments || {}
        
        if (toolName === "submit_suggestion") {
          const { content, targetFile } = toolArgs
          
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
          
          return Response.json({
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
          })
        }
        
        if (toolName === "list_context_files") {
          return Response.json({
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
          })
        }
        
        return Response.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Unknown tool: ${toolName}`
          }
        })
        
      case "notifications/initialized":
        // Client acknowledges initialization
        return Response.json({ jsonrpc: "2.0", id, result: {} })
        
      default:
        return Response.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        })
    }
  } catch (error) {
    console.error("[MCP SSE] Error:", error)
    return Response.json({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: "Parse error"
      }
    })
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  })
}
