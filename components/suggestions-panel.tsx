"use client"

import { useState, useCallback } from "react"
import { ChevronDown, ChevronUp, Check, X, Clock, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useGitHub } from "@/contexts/github-context"
import { getSuggestionsForFile, type Suggestion, type SuggestionStatus } from "@/lib/mock-suggestions"
import { cn } from "@/lib/utils"

interface SuggestionsPanelProps {
  onIncorporated: (newContent: string) => void
  onProcessingChange: (processing: boolean) => void
  isProcessing: boolean
}

const TYPE_CONFIG = {
  enhancement: { label: "Enhancement", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800" },
  addition: { label: "Addition", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" },
  clarification: { label: "Clarification", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" },
}

export function SuggestionsPanel({ onIncorporated, onProcessingChange, isProcessing }: SuggestionsPanelProps) {
  const { selectedFile, fileContent } = useGitHub()

  const allSuggestions = selectedFile ? getSuggestionsForFile(selectedFile.name) : []

  const [statuses, setStatuses] = useState<Record<string, SuggestionStatus>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showDeferred, setShowDeferred] = useState(false)

  const setStatus = useCallback((id: string, status: SuggestionStatus) => {
    setStatuses((prev) => ({ ...prev, [id]: status }))
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // Filter visible suggestions
  const visibleSuggestions = allSuggestions.filter((s) => {
    const status = statuses[s.id]
    if (!status) return true
    if (status === "later" && showDeferred) return true
    return false
  })

  const acceptedIds = allSuggestions.filter((s) => statuses[s.id] === "accepted").map((s) => s.id)
  const deferredCount = allSuggestions.filter((s) => statuses[s.id] === "later").length

  const handleIncorporate = async () => {
    onProcessingChange(true)
    // Simulate AI processing (3 seconds)
    await new Promise((r) => setTimeout(r, 3000))

    const accepted = allSuggestions.filter((s) => statuses[s.id] === "accepted")
    let newContent = fileContent

    // Apply accepted suggestions
    for (const s of accepted) {
      if (s.before && newContent.includes(s.before)) {
        newContent = newContent.replace(s.before, s.after)
      } else if (!s.before) {
        // Addition: append to end
        newContent = newContent.trimEnd() + "\n\n" + s.after + "\n"
      }
    }

    onProcessingChange(false)
    onIncorporated(newContent)
  }

  if (allSuggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No suggestions available</p>
          <p className="text-sm text-muted-foreground mt-1">
            AI suggestions will appear here when this file is analyzed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Deferred banner */}
      {deferredCount > 0 && !showDeferred && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-sm">
          <span className="text-amber-700 dark:text-amber-400">
            {deferredCount} suggestion{deferredCount > 1 ? "s" : ""} saved for later.
          </span>
          <button
            onClick={() => setShowDeferred(true)}
            className="text-amber-700 dark:text-amber-400 font-medium underline underline-offset-2 hover:no-underline text-xs"
          >
            View
          </button>
        </div>
      )}
      {showDeferred && deferredCount > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-sm">
          <span className="text-amber-700 dark:text-amber-400">Showing deferred suggestions.</span>
          <button
            onClick={() => setShowDeferred(false)}
            className="text-amber-700 dark:text-amber-400 font-medium underline underline-offset-2 hover:no-underline text-xs"
          >
            Hide
          </button>
        </div>
      )}

      {/* Suggestions list */}
      <div className="flex-1 overflow-y-auto">
        {visibleSuggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
            <Check className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium">All suggestions reviewed</p>
            <p className="text-sm text-muted-foreground">
              {acceptedIds.length > 0
                ? `${acceptedIds.length} accepted. Click "Incorporate Changes" below.`
                : "No suggestions were accepted."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {visibleSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                isExpanded={!!expanded[suggestion.id]}
                onToggleExpand={() => toggleExpand(suggestion.id)}
                onAccept={() => setStatus(suggestion.id, "accepted")}
                onReject={() => setStatus(suggestion.id, "rejected")}
                onDefer={() => setStatus(suggestion.id, "later")}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-3 bg-background">
        <Button
          className="w-full"
          onClick={handleIncorporate}
          disabled={acceptedIds.length === 0 || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Incorporating changes...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Incorporate Changes
              {acceptedIds.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-primary-foreground/20 text-primary-foreground">
                  {acceptedIds.length}
                </Badge>
              )}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function SuggestionCard({
  suggestion,
  isExpanded,
  onToggleExpand,
  onAccept,
  onReject,
  onDefer,
}: {
  suggestion: Suggestion
  isExpanded: boolean
  onToggleExpand: () => void
  onAccept: () => void
  onReject: () => void
  onDefer: () => void
}) {
  const typeConfig = TYPE_CONFIG[suggestion.type]

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-2">
        <Badge variant="outline" className={cn("text-xs font-medium shrink-0 mt-0.5", typeConfig.className)}>
          {typeConfig.label}
        </Badge>
        <p className="text-sm font-medium leading-snug">{suggestion.title}</p>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed">{suggestion.description}</p>

      {/* Diff toggle */}
      <button
        onClick={onToggleExpand}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {isExpanded ? "Hide diff" : "Show diff"}
      </button>

      {/* Diff */}
      {isExpanded && (
        <div className="flex flex-col gap-2 text-xs font-mono rounded-md overflow-hidden border">
          {suggestion.before && (
            <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800">
              <div className="px-3 py-1.5 text-red-700 dark:text-red-400 font-sans text-xs font-medium border-b border-red-200 dark:border-red-800 bg-red-100/50 dark:bg-red-950/50">
                Current
              </div>
              <pre className="px-3 py-2.5 text-red-800 dark:text-red-300 whitespace-pre-wrap leading-relaxed">
                {suggestion.before}
              </pre>
            </div>
          )}
          <div className="bg-emerald-50 dark:bg-emerald-950/30">
            <div className="px-3 py-1.5 text-emerald-700 dark:text-emerald-400 font-sans text-xs font-medium border-b border-emerald-200 dark:border-emerald-800 bg-emerald-100/50 dark:bg-emerald-950/50">
              Proposed
            </div>
            <pre className="px-3 py-2.5 text-emerald-800 dark:text-emerald-300 whitespace-pre-wrap leading-relaxed">
              {suggestion.after}
            </pre>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={onAccept}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8"
        >
          <Check className="h-3.5 w-3.5" />
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDefer}
          className="flex-1 h-8"
        >
          <Clock className="h-3.5 w-3.5" />
          Later
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          className="flex-1 h-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </Button>
      </div>
    </div>
  )
}
