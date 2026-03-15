export interface Suggestion {
  id: string
  fileId: string
  type: "change" | "addition" | "clarification" | "other"
  summary: string // 1-sentence summary shown in collapsed view
  detail: string // Full detail shown when expanded
  before?: string
  after: string
}

export type SuggestionStatus = "accepted" | "rejected" | "later"

// Empty array - all suggestions now come from user actions via the SuggestionsContext
const suggestions: Suggestion[] = []

export function getSuggestionsForFile(fileName: string): Suggestion[] {
  const normalizedName = fileName.toLowerCase()
  return suggestions.filter((s) => s.fileId.toLowerCase() === normalizedName)
}

export function getAllMockFileNames(): string[] {
  return []
}
