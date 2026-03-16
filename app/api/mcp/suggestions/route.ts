import { NextRequest, NextResponse } from "next/server"

/**
 * API endpoint to manage MCP-submitted suggestions
 * 
 * GET: Retrieve pending suggestions for a project
 * DELETE: Clear processed suggestions
 */

// Shared suggestion store (imported from main MCP route would be better in production)
// For now, we use a simple in-memory store
const suggestionStore = new Map<string, Array<{
  id: string
  file_path: string
  type: "add" | "update" | "remove"
  before: string
  after: string
  rationale: string
  source: string
  timestamp: string
  status: "pending" | "processed"
}>>()

// Export for use by other modules
export function getMcpSuggestions(projectId: string) {
  return suggestionStore.get(projectId) || []
}

export function addMcpSuggestion(projectId: string, suggestion: {
  id: string
  file_path: string
  type: "add" | "update" | "remove"
  before: string
  after: string
  rationale: string
  source: string
  timestamp: string
  status: "pending" | "processed"
}) {
  const suggestions = suggestionStore.get(projectId) || []
  suggestions.push(suggestion)
  suggestionStore.set(projectId, suggestions)
}

export function markMcpSuggestionProcessed(projectId: string, suggestionId: string) {
  const suggestions = suggestionStore.get(projectId) || []
  const suggestion = suggestions.find(s => s.id === suggestionId)
  if (suggestion) {
    suggestion.status = "processed"
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("project_id")
  
  if (!projectId) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 })
  }
  
  const suggestions = getMcpSuggestions(projectId).filter(s => s.status === "pending")
  return NextResponse.json({ suggestions })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("project_id")
  const suggestionId = searchParams.get("suggestion_id")
  
  if (!projectId) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 })
  }
  
  if (suggestionId) {
    markMcpSuggestionProcessed(projectId, suggestionId)
  } else {
    // Clear all for project
    suggestionStore.delete(projectId)
  }
  
  return NextResponse.json({ success: true })
}
