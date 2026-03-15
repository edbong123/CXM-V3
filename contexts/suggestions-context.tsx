"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export interface Suggestion {
  id: string
  fileName: string
  summary: string
  before?: string
  after: string
  createdAt: Date
}

interface SuggestionsContextType {
  suggestions: Suggestion[]
  addSuggestion: (suggestion: Omit<Suggestion, "id" | "createdAt">) => void
  removeSuggestion: (id: string) => void
  getSuggestionsForFile: (fileName: string) => Suggestion[]
  clearSuggestionsForFile: (fileName: string) => void
}

const SuggestionsContext = createContext<SuggestionsContextType | null>(null)

export function SuggestionsProvider({ children }: { children: ReactNode }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  const addSuggestion = useCallback((suggestion: Omit<Suggestion, "id" | "createdAt">) => {
    const newSuggestion: Suggestion = {
      ...suggestion,
      id: `suggestion-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date()
    }
    setSuggestions(prev => [...prev, newSuggestion])
  }, [])

  const removeSuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id))
  }, [])

  const getSuggestionsForFile = useCallback((fileName: string) => {
    // Match by filename (without extension)
    const normalizedName = fileName.replace(/\.(md|txt)$/, "").toLowerCase()
    return suggestions.filter(s => 
      s.fileName.replace(/\.(md|txt)$/, "").toLowerCase() === normalizedName
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
