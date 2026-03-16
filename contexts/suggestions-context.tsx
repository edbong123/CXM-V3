"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export type SuggestionStatus = "pending" | "accepted" | "rejected" | "later" | "processed"

export interface Suggestion {
  id: string
  fileName: string
  summary: string
  before?: string
  after: string
  status: SuggestionStatus
  createdAt: Date
  source?: "chat" | "mcp" | "mock"  // Track where suggestion came from
}

interface SuggestionsContextType {
  suggestions: Suggestion[]
  addSuggestion: (suggestion: Omit<Suggestion, "id" | "createdAt" | "status">) => void
  addSuggestionWithId: (suggestion: Omit<Suggestion, "createdAt" | "status">) => void
  removeSuggestion: (id: string) => void
  updateSuggestionStatus: (id: string, status: SuggestionStatus) => void
  getSuggestionsForFile: (fileName: string, includeStatuses?: SuggestionStatus[]) => Suggestion[]
  clearSuggestionsForFile: (fileName: string) => void
}

const SuggestionsContext = createContext<SuggestionsContextType | null>(null)

export function SuggestionsProvider({ children }: { children: ReactNode }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  const addSuggestion = useCallback((suggestion: Omit<Suggestion, "id" | "createdAt" | "status">) => {
    const newSuggestion: Suggestion = {
      ...suggestion,
      id: `suggestion-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      status: "pending",
      createdAt: new Date(),
      source: suggestion.source || "chat"
    }
    setSuggestions(prev => [...prev, newSuggestion])
  }, [])

  // Add suggestion with a specific ID (for MCP suggestions)
  const addSuggestionWithId = useCallback((suggestion: Omit<Suggestion, "createdAt" | "status">) => {
    // Check if suggestion with this ID already exists
    setSuggestions(prev => {
      if (prev.some(s => s.id === suggestion.id)) {
        return prev // Already exists
      }
      return [...prev, {
        ...suggestion,
        status: "pending" as SuggestionStatus,
        createdAt: new Date()
      }]
    })
  }, [])

  const removeSuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id))
  }, [])

  const updateSuggestionStatus = useCallback((id: string, status: SuggestionStatus) => {
    setSuggestions(prev => prev.map(s => 
      s.id === id ? { ...s, status } : s
    ))
  }, [])

  const getSuggestionsForFile = useCallback((fileName: string, includeStatuses: SuggestionStatus[] = ["pending"]) => {
    // Match by filename (without extension)
    const normalizedName = fileName.replace(/\.(md|txt)$/, "").toLowerCase()
    return suggestions.filter(s => 
      s.fileName.replace(/\.(md|txt)$/, "").toLowerCase() === normalizedName &&
      includeStatuses.includes(s.status)
    )
  }, [suggestions])

  const clearSuggestionsForFile = useCallback((fileName: string) => {
    const normalizedName = fileName.replace(/\.(md|txt)$/, "").toLowerCase()
    setSuggestions(prev => prev.filter(s => 
      s.fileName.replace(/\.(md|txt)$/, "").toLowerCase() !== normalizedName
    ))
  }, [])

  return (
    <SuggestionsContext.Provider value={{
      suggestions,
      addSuggestion,
      addSuggestionWithId,
      removeSuggestion,
      updateSuggestionStatus,
      getSuggestionsForFile,
      clearSuggestionsForFile
    }}>
      {children}
    </SuggestionsContext.Provider>
  )
}

export function useSuggestions() {
  const context = useContext(SuggestionsContext)
  if (!context) {
    throw new Error("useSuggestions must be used within a SuggestionsProvider")
  }
  return context
}
