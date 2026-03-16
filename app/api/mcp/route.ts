import { NextRequest, NextResponse } from "next/server"
import { addMcpSuggestion, getPendingMcpSuggestions, type McpSuggestion } from "@/lib/mcp-store"

/**
 * Simple MCP Server - No Authentication Required
 * Implements Model Context Protocol for receiving suggestions
 */

// Tool definitions
const TOOLS = [
  {
    name: "submit_suggestion",
    description: "Submit a suggestion for a context file. The suggestion will appear in the Context Manager UI for review.",
    inputSchema: {
      type: "object",
      properties: {
        suggestion: {
          type: "string",
          description: "The suggestion text content"
        },
        file_hint: {
          type: "string",
          description: "Optional hint about which file this applies to (e.g., 'decisions', 'questions', 'roles')"
        },
        rationale: {
          type: "string",
          description: "Why this suggestion is being made"
        }
      },
      required: ["suggestion"]
    }
  },
  {
    name: "list_context_files",
    description: "List the standard context files available",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  }
]

// Standard context files
const CONTEXT_FILES = [
  { name: "DECISIONS.md", description: "Technical and business decisions", keywords: ["decision", "decided", "chose", "architecture"] },
  { name: "OPEN-QUESTIONS.md", description: "Unresolved questions", keywords: ["question", "unclear", "todo", "investigate"] },
  { name: "ROLES.md", description: "Team roles and responsibilities", keywords: ["role", "responsibility", "team", "owner"] },
  { name: "TASKS.md", description: "Current tasks", keywords: ["task", "todo", "action", "implement"] },
  { name: "NOTES.md", description: "General notes", keywords: ["note", "observation", "finding"] },
  { name: "GLOSSARY.md", description: "Terminology", keywords: ["term", "definition", "glossary", "meaning"] },
  { name: "DISCOVERY.md", description: "Research findings", keywords: ["discovery", "research", "learned", "found"] },
  { name: "PROJECT.md", description: "Project overview", keywords: ["project", "goal", "objective", "scope"] }
]

// Detect which file a suggestion belongs to
function detectTargetFile(suggestion: string, hint?: string): string {
  const text = (suggestion + " " + (hint || "")).toLowerCase()
  
  for (const file of CONTEXT_FILES) {
    for (const keyword of file.keywords) {
      if (text.includes(keyword)) {
        return file.name
      }
    }
  }
  
  return "NOTES.md" // Default
}

// MCP Protocol handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Validate JSON-RPC format
    if (body.jsonrpc !== "2.0" || !body.method) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: body.id || null,
        error: { code: -32600, message: "Invalid Request" }
      })
    }
    
    // Handle MCP methods
    switch (body.method) {
      case "initialize": {
        return NextResponse.json({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: "cxm-suggestions",
              version: "1.0.0"
            }
          }
        })
      }
      
      case "notifications/initialized": {
        // Notification - no response needed
        return new Response(null, { status: 202 })
      }
      
      case "tools/list": {
        return NextResponse.json({
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: TOOLS }
        })
      }
      
      case "tools/call": {
        const params = body.params as { name: string; arguments?: Record<string, unknown> }
        const toolName = params?.name
        const toolArgs = params?.arguments || {}
        
        if (toolName === "list_context_files") {
          return NextResponse.json({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              content: [{
                type: "text",
                text: JSON.stringify({
                  files: CONTEXT_FILES.map(f => ({ name: f.name, description: f.description }))
                }, null, 2)
              }]
            }
          })
        }
        
        if (toolName === "submit_suggestion") {
          const { suggestion, file_hint, rationale } = toolArgs as {
            suggestion: string
            file_hint?: string
            rationale?: string
          }
          
          if (!suggestion) {
            return NextResponse.json({
              jsonrpc: "2.0",
              id: body.id,
              error: { code: -32602, message: "Missing required parameter: suggestion" }
            })
          }
          
          const targetFile = detectTargetFile(suggestion, file_hint)
          
          // Store the suggestion
          const suggestionObj: McpSuggestion = {
            id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            project_id: "default",
            file_path: `context/${targetFile}`,
            type: "add",
            before: "",
            after: suggestion,
            rationale: rationale || "Submitted via MCP",
            source: "claude-mcp",
            timestamp: new Date().toISOString(),
            status: "pending"
          }
          
          addMcpSuggestion(suggestionObj)
          
          return NextResponse.json({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: true,
                  suggestion_id: suggestionObj.id,
                  target_file: targetFile,
                  message: `Suggestion submitted for ${targetFile}. It will appear in the Context Manager for review.`
                }, null, 2)
              }]
            }
          })
        }
        
        return NextResponse.json({
          jsonrpc: "2.0",
          id: body.id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` }
        })
      }
      
      case "ping": {
        return NextResponse.json({
          jsonrpc: "2.0",
          id: body.id,
          result: {}
        })
      }
      
      default: {
        return NextResponse.json({
          jsonrpc: "2.0",
          id: body.id,
          error: { code: -32601, message: `Method not found: ${body.method}` }
        })
      }
    }
    
  } catch (error) {
    console.error("[MCP] Error:", error)
    return NextResponse.json({
      jsonrpc: "2.0",
      id: null,
      error: { 
        code: -32700, 
        message: "Parse error"
      }
    }, { status: 400 })
  }
}

// GET handler for SSE (server-to-client messages)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("project_id")
  
  // If project_id provided, return suggestions for that project
  if (projectId) {
    const suggestions = getPendingMcpSuggestions(projectId)
    return NextResponse.json({ suggestions })
  }
  
  // Otherwise return SSE stream
  const accept = req.headers.get("accept") || ""
  
  if (!accept.includes("text/event-stream")) {
    // Return simple status
    return NextResponse.json({
      status: "ok",
      server: "cxm-suggestions",
      version: "1.0.0"
    })
  }
  
  // Return SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // Send initial ping
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "ping" })}\n\n`))
    }
  })
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  })
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id",
    }
  })
}
