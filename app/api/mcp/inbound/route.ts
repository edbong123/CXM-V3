import { NextRequest, NextResponse } from "next/server"

/**
 * MCP Inbound API - Receives suggestions from external MCP clients (e.g., Claude)
 * 
 * POST /api/mcp/inbound
 * 
 * The API will:
 * 1. Accept a suggestion with content
 * 2. Auto-determine which context file(s) the suggestion applies to
 * 3. Store it for the project to review
 */

// In-memory store for MCP suggestions (keyed by project repo)
const mcpSuggestionStore = new Map<string, Array<{
  id: string
  content: string
  targetFiles: string[]
  summary: string
  source: string
  timestamp: string
  status: "pending" | "accepted" | "rejected"
}>>()

// Context file patterns for auto-detection
const CONTEXT_FILE_PATTERNS: Record<string, string[]> = {
  "DECISIONS": ["decision", "architecture", "choice", "why we", "rationale", "trade-off", "tradeoff"],
  "GLOSSARY": ["term", "definition", "meaning", "glossary", "vocabulary", "jargon"],
  "PROJECT": ["project", "overview", "summary", "about", "introduction", "scope"],
  "ROLES": ["role", "persona", "team", "responsibility", "who"],
  "TASKS": ["task", "todo", "action", "work item", "sprint", "milestone"],
  "DISCOVERY": ["discovery", "research", "finding", "insight", "learned"],
  "NOTES": ["note", "observation", "thought", "idea", "misc"],
  "OPEN-QUESTIONS": ["question", "unknown", "unclear", "need to", "investigate", "tbd", "?"],
}

function detectTargetFiles(content: string): string[] {
  const contentLower = content.toLowerCase()
  const matches: Array<{ file: string; score: number }> = []
  
  for (const [file, keywords] of Object.entries(CONTEXT_FILE_PATTERNS)) {
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
  
  // Sort by score and return top matches
  matches.sort((a, b) => b.score - a.score)
  
  // Return files with score > 0, or default to NOTES if no match
  const targetFiles = matches.filter(m => m.score > 0).map(m => m.file)
  return targetFiles.length > 0 ? targetFiles : ["NOTES"]
}

function generateSummary(content: string): string {
  // Take first sentence or first 100 chars
  const firstSentence = content.split(/[.!?]/)[0]
  if (firstSentence.length <= 100) {
    return firstSentence.trim()
  }
  return content.slice(0, 97).trim() + "..."
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { project_id, content, source = "mcp-client", target_files } = body
    
    if (!project_id) {
      return NextResponse.json({ 
        error: "project_id is required" 
      }, { status: 400 })
    }
    
    if (!content || typeof content !== "string") {
      return NextResponse.json({ 
        error: "content is required and must be a string" 
      }, { status: 400 })
    }
    
    // Auto-detect target files or use provided ones
    const targetFiles = target_files && Array.isArray(target_files) && target_files.length > 0
      ? target_files
      : detectTargetFiles(content)
    
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
      message: `Suggestion received and will be reviewed. Target file(s): ${targetFiles.join(", ")}`
    })
  } catch (error) {
    console.error("MCP inbound error:", error)
    return NextResponse.json({ 
      error: "Invalid request body" 
    }, { status: 400 })
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
