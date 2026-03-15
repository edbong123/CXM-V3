"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export type SuggestionStatus = "pending" | "accepted" | "rejected" | "later"

export interface Suggestion {
  id: string
  fileName: string
  summary: string
  before?: string
  after: string
  status: SuggestionStatus
  createdAt: Date
}

interface SuggestionsContextType {
  suggestions: Suggestion[]
  addSuggestion: (suggestion: Omit<Suggestion, "id" | "createdAt" | "status">) => void
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
      createdAt: new Date()
    }
    setSuggestions(prev => [...prev, newSuggestion])
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
