/**
 * Shared in-memory store for MCP suggestions
 * 
 * In production, this should be replaced with a database (e.g., Supabase, Redis)
 * For now, we use a global Map that persists across API calls within the same server instance
 */

export interface McpSuggestion {
  id: string
  project_id: string
  file_path: string
  type: "add" | "update" | "remove"
  before: string
  after: string
  rationale: string
  source: string
  timestamp: string
  status: "pending" | "processed"
}

// Global store - persists for the lifetime of the server process
declare global {
  // eslint-disable-next-line no-var
  var mcpSuggestionStore: Map<string, McpSuggestion[]> | undefined
}

// Use global to persist across hot reloads in development
const suggestionStore = globalThis.mcpSuggestionStore ?? new Map<string, McpSuggestion[]>()
globalThis.mcpSuggestionStore = suggestionStore

export function getMcpSuggestions(projectId: string): McpSuggestion[] {
  return suggestionStore.get(projectId) || []
}

export function getPendingMcpSuggestions(projectId: string): McpSuggestion[] {
  return getMcpSuggestions(projectId).filter(s => s.status === "pending")
}

export function addMcpSuggestion(suggestion: McpSuggestion): void {
  const suggestions = suggestionStore.get(suggestion.project_id) || []
  suggestions.push(suggestion)
  suggestionStore.set(suggestion.project_id, suggestions)
}

export function markMcpSuggestionProcessed(projectId: string, suggestionId: string): void {
  const suggestions = suggestionStore.get(projectId)
  if (suggestions) {
    const suggestion = suggestions.find(s => s.id === suggestionId)
    if (suggestion) {
      suggestion.status = "processed"
    }
  }
}

export function clearMcpSuggestions(projectId: string): void {
  suggestionStore.delete(projectId)
}

export function getAllProjectsWithSuggestions(): string[] {
  return Array.from(suggestionStore.keys())
}
