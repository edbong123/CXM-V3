import { NextRequest, NextResponse } from "next/server"

/**
 * MCP (Model Context Protocol) Server for Context Manager
 * 
 * This endpoint allows external AI assistants to:
 * - List available projects
 * - Get context files for a project
 * - Submit suggestions to context files
 * 
 * Authentication: Bearer token (GitHub PAT) in Authorization header
 */

// MCP Protocol types
interface MCPRequest {
  jsonrpc: "2.0"
  id: string | number
  method: string
  params?: Record<string, unknown>
}

interface MCPResponse {
  jsonrpc: "2.0"
  id: string | number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

interface MCPToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
  }
}

// Tool definitions
const TOOLS: MCPToolDefinition[] = [
  {
    name: "list_projects",
    description: "List all available projects (repositories) configured in the Context Manager",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_project_files",
    description: "Get all context files for a specific project",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "The project ID (repository in owner/repo format)"
        }
      },
      required: ["project_id"]
    }
  },
  {
    name: "get_file_content",
    description: "Get the content of a specific context file",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "The project ID (repository in owner/repo format)"
        },
        file_path: {
          type: "string",
          description: "Path to the file within the context folder (e.g., 'DECISIONS.md')"
        }
      },
      required: ["project_id", "file_path"]
    }
  },
  {
    name: "submit_suggestion",
    description: "Submit a suggestion for a context file. The suggestion will appear in the Context Manager UI for review.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "The project ID (repository in owner/repo format)"
        },
        file_path: {
          type: "string",
          description: "Path to the file (e.g., 'context/DECISIONS.md')"
        },
        suggestion_type: {
          type: "string",
          enum: ["add", "update", "remove"],
          description: "Type of suggestion: add new content, update existing, or remove content"
        },
        before: {
          type: "string",
          description: "The original text to be replaced (for update/remove). Empty for 'add' type."
        },
        after: {
          type: "string",
          description: "The new text to insert (for add/update). Empty for 'remove' type."
        },
        rationale: {
          type: "string",
          description: "Explanation of why this change is suggested"
        },
        source: {
          type: "string",
          description: "Source identifier (e.g., 'claude-mcp', 'chatgpt-mcp')"
        }
      },
      required: ["project_id", "file_path", "suggestion_type", "after", "rationale"]
    }
  }
]

// GitHub API helpers
async function fetchWithGitHub(token: string, url: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  })
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

async function getContextFiles(token: string, repo: string) {
  try {
    const data = await fetchWithGitHub(
      token,
      `https://api.github.com/repos/${repo}/contents/context`
    )
    if (!Array.isArray(data)) return []
    return data
      .filter((item: { type: string; name: string }) => item.type === "file" && item.name.endsWith(".md"))
      .map((item: { name: string; path: string; sha: string }) => ({
        name: item.name,
        path: item.path,
        sha: item.sha
      }))
  } catch {
    return []
  }
}

async function getFileContent(token: string, repo: string, path: string) {
  const data = await fetchWithGitHub(
    token,
    `https://api.github.com/repos/${repo}/contents/${path}`
  )
  const content = Buffer.from(data.content, "base64").toString("utf-8")
  return { content, sha: data.sha }
}

import { addMcpSuggestion, getPendingMcpSuggestions, type McpSuggestion } from "@/lib/mcp-store"

// Tool handlers
async function handleListProjects(token: string) {
  // Verify token works by fetching user
  const user = await fetchWithGitHub(token, "https://api.github.com/user")
  
  // Get user's repositories
  const repos = await fetchWithGitHub(
    token,
    "https://api.github.com/user/repos?per_page=100&sort=updated"
  )
  
  // Filter to repos that have a context folder
  const projectsWithContext = []
  for (const repo of repos.slice(0, 20)) { // Limit to first 20 for performance
    try {
      await fetchWithGitHub(token, `https://api.github.com/repos/${repo.full_name}/contents/context`)
      projectsWithContext.push({
        id: repo.full_name,
        name: repo.name,
        owner: repo.owner.login,
        description: repo.description,
        url: repo.html_url
      })
    } catch {
      // No context folder, skip
    }
  }
  
  return {
    user: user.login,
    projects: projectsWithContext
  }
}

async function handleGetProjectFiles(token: string, params: { project_id: string }) {
  const files = await getContextFiles(token, params.project_id)
  return {
    project_id: params.project_id,
    files: files.map((f: { name: string; path: string }) => ({
      name: f.name,
      path: f.path
    }))
  }
}

async function handleGetFileContent(token: string, params: { project_id: string; file_path: string }) {
  const { content, sha } = await getFileContent(token, params.project_id, params.file_path)
  return {
    project_id: params.project_id,
    file_path: params.file_path,
    content,
    sha
  }
}

async function handleSubmitSuggestion(
  token: string, 
  params: {
    project_id: string
    file_path: string
    suggestion_type: "add" | "update" | "remove"
    before?: string
    after: string
    rationale: string
    source?: string
  }
) {
  // Verify the project exists and user has access
  await fetchWithGitHub(token, `https://api.github.com/repos/${params.project_id}`)
  
  // Create suggestion
  const suggestion: McpSuggestion = {
    id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    project_id: params.project_id,
    file_path: params.file_path,
    type: params.suggestion_type,
    before: params.before || "",
    after: params.after,
    rationale: params.rationale,
    source: params.source || "mcp-client",
    timestamp: new Date().toISOString(),
    status: "pending"
  }
  
  // Store suggestion using shared store
  addMcpSuggestion(suggestion)
  
  return {
    success: true,
    suggestion_id: suggestion.id,
    message: `Suggestion submitted for ${params.file_path}. It will appear in the Context Manager UI for review.`
  }
}

// Get pending suggestions for a project (internal API for the UI)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("project_id")
  
  if (!projectId) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 })
  }
  
  const suggestions = suggestionStore.get(projectId) || []
  return NextResponse.json({ suggestions })
}

// MCP Protocol handler
export async function POST(req: NextRequest) {
  try {
    const body: MCPRequest = await req.json()
    
    // Validate JSON-RPC format
    if (body.jsonrpc !== "2.0" || !body.method) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: body.id || null,
        error: { code: -32600, message: "Invalid Request" }
      } as MCPResponse)
    }
    
    // Get auth token
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    
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
              name: "context-manager-mcp",
              version: "1.0.0"
            }
          }
        } as MCPResponse)
      }
      
      case "tools/list": {
        return NextResponse.json({
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: TOOLS }
        } as MCPResponse)
      }
      
      case "tools/call": {
        if (!token) {
          return NextResponse.json({
            jsonrpc: "2.0",
            id: body.id,
            error: { 
              code: -32001, 
              message: "Authentication required. Provide GitHub PAT in Authorization header." 
            }
          } as MCPResponse)
        }
        
        const params = body.params as { name: string; arguments?: Record<string, unknown> }
        const toolName = params?.name
        const toolArgs = params?.arguments || {}
        
        try {
          let result: unknown
          
          switch (toolName) {
            case "list_projects":
              result = await handleListProjects(token)
              break
            case "get_project_files":
              result = await handleGetProjectFiles(token, toolArgs as { project_id: string })
              break
            case "get_file_content":
              result = await handleGetFileContent(token, toolArgs as { project_id: string; file_path: string })
              break
            case "submit_suggestion":
              result = await handleSubmitSuggestion(token, toolArgs as {
                project_id: string
                file_path: string
                suggestion_type: "add" | "update" | "remove"
                before?: string
                after: string
                rationale: string
                source?: string
              })
              break
            default:
              return NextResponse.json({
                jsonrpc: "2.0",
                id: body.id,
                error: { code: -32601, message: `Unknown tool: ${toolName}` }
              } as MCPResponse)
          }
          
          return NextResponse.json({
            jsonrpc: "2.0",
            id: body.id,
            result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
          } as MCPResponse)
          
        } catch (error) {
          return NextResponse.json({
            jsonrpc: "2.0",
            id: body.id,
            error: { 
              code: -32000, 
              message: error instanceof Error ? error.message : "Tool execution failed" 
            }
          } as MCPResponse)
        }
      }
      
      default: {
        return NextResponse.json({
          jsonrpc: "2.0",
          id: body.id,
          error: { code: -32601, message: "Method not found" }
        } as MCPResponse)
      }
    }
    
  } catch (error) {
    return NextResponse.json({
      jsonrpc: "2.0",
      id: null,
      error: { 
        code: -32700, 
        message: "Parse error",
        data: error instanceof Error ? error.message : undefined
      }
    } as MCPResponse)
  }
}
