"use client"

import { useState, useCallback } from "react"
import { ChevronDown, Check, X, Clock, Sparkles, Loader2, Plus, PenLine, HelpCircle, MoreHorizontal, MessageSquarePlus, ScanSearch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useGitHub } from "@/contexts/github-context"
import { useSuggestions, type Suggestion, type SuggestionStatus } from "@/contexts/suggestions-context"
import { getSuggestionsForFile as getMockSuggestionsForFile } from "@/lib/mock-suggestions"
import { cn } from "@/lib/utils"

function renderMarkdownAsText(markdown: string): string {
  return markdown
    .replace(/\*\*(.+?)\*\*/g, "$1") // Remove bold markers
    .replace(/\*(.+?)\*/g, "$1") // Remove italic markers
    .replace(/`([^`]+)`/g, "$1") // Remove inline code markers
    .replace(/^### /gm, "• ") // Convert h3 to bullets
    .replace(/^## /gm, "") // Remove h2 markers but keep text
    .replace(/^# /gm, "") // Remove h1 markers but keep text
}

interface SuggestionsPanelProps {
  onIncorporated: (newContent: string, acceptedCount: number, commitSummary: string) => void
  onProcessingChange: (processing: boolean) => void
  isProcessing: boolean
  onOpenChat?: (fileName: string, mode?: "suggest" | "ask-questions") => void
}

const TYPE_CONFIG: Record<Suggestion["type"] | "mock", { label: string; icon: React.ElementType; className: string }> = {
  change: { 
    label: "Change", 
    icon: PenLine, 
    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800" 
  },
  addition: { 
    label: "Addition", 
    icon: Plus, 
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" 
  },
  clarification: { 
    label: "Clarification", 
    icon: HelpCircle, 
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" 
  },
  other: { 
    label: "Other", 
    icon: MoreHorizontal, 
    className: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/40 dark:text-gray-400 dark:border-gray-800" 
  },
  mock: { 
    label: "Suggestion", 
    icon: Sparkles, 
    className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800" 
  },
}

export function SuggestionsPanel({ onIncorporated, onProcessingChange, isProcessing, onOpenChat }: SuggestionsPanelProps) {
  const { selectedFile, selectedFileContent: fileContent } = useGitHub()
  const { getSuggestionsForFile, updateSuggestionStatus } = useSuggestions()

  // Get mock suggestions from the library
  const fileToCheck = selectedFile ? selectedFile.name.replace(/\.md$/, "") : ""
  const mockSuggestions = fileToCheck ? getMockSuggestionsForFile(fileToCheck) : []
  
  // Local state for mock suggestion statuses (since they're not in context)
  const [mockStatuses, setMockStatuses] = useState<Record<string, SuggestionStatus>>({})
  
  // Get user-added suggestions from context (pending ones, and later if showing deferred)
  const [showDeferred, setShowDeferred] = useState(false)
  const pendingUserSuggestions = fileToCheck ? getSuggestionsForFile(fileToCheck, ["pending"]).map(s => ({
    id: s.id,
    fileId: fileToCheck,
    type: "mock" as const,
    summary: s.summary,
    detail: s.summary,
    before: s.before,
    after: s.after,
    status: s.status,
  })) : []
  
  const deferredUserSuggestions = fileToCheck ? getSuggestionsForFile(fileToCheck, ["later"]).map(s => ({
    id: s.id,
    fileId: fileToCheck,
    type: "mock" as const,
    summary: s.summary,
    detail: s.summary,
    before: s.before,
    after: s.after,
    status: s.status,
  })) : []

  const acceptedUserSuggestions = fileToCheck ? getSuggestionsForFile(fileToCheck, ["accepted"]).map(s => ({
    id: s.id,
    fileId: fileToCheck,
    type: "mock" as const,
    summary: s.summary,
    detail: s.summary,
    before: s.before,
    after: s.after,
    status: s.status,
  })) : []
  
  // Combine mock and user suggestions
  const visibleMockSuggestions = mockSuggestions.filter(s => {
    const status = mockStatuses[s.id]
    if (!status) return true
    if (status === "later" && showDeferred) return true
    return false
  })
  
  const visibleUserSuggestions = showDeferred 
    ? [...pendingUserSuggestions, ...deferredUserSuggestions]
    : pendingUserSuggestions
    
  const allSuggestions = [...visibleMockSuggestions, ...visibleUserSuggestions]

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState(0)
  const [analyzeStep, setAnalyzeStep] = useState("")

  const setStatus = useCallback((id: string, status: SuggestionStatus) => {
    // Check if this is a context suggestion (starts with 'suggestion-') or a mock
    if (id.startsWith("suggestion-")) {
      updateSuggestionStatus(id, status)
    } else {
      setMockStatuses((prev) => ({ ...prev, [id]: status }))
    }
  }, [updateSuggestionStatus])

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // Calculate counts
  const acceptedMockIds = mockSuggestions.filter(s => mockStatuses[s.id] === "accepted").map(s => s.id)
  const acceptedIds = [...acceptedMockIds, ...acceptedUserSuggestions.map(s => s.id)]
  
  const deferredMockCount = mockSuggestions.filter(s => mockStatuses[s.id] === "later").length
  const deferredCount = deferredMockCount + deferredUserSuggestions.length

  const handleProcessSuggestions = async () => {
    onProcessingChange(true)

    // Get accepted mock suggestions
    const acceptedMock = mockSuggestions.filter(s => mockStatuses[s.id] === "accepted")
    // Combine with accepted user suggestions
    const allAccepted = [...acceptedMock, ...acceptedUserSuggestions]
    
    if (allAccepted.length === 0) {
      onProcessingChange(false)
      return
    }

    try {
      // Call the LLM API to process suggestions
      const response = await fetch("/api/process-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentContent: fileContent,
          documentName: selectedFile?.name || "Document",
          acceptedSuggestions: allAccepted.map(s => ({
            id: s.id,
            summary: s.summary,
            before: s.before,
            after: s.after,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      const newContent = data.newContent || fileContent
      const commitSummary = data.commitSummary || ""

      // Mark all processed suggestions so they disappear from the panel
      for (const s of allAccepted) {
        if (s.id.startsWith("suggestion-")) {
          updateSuggestionStatus(s.id, "processed")
        } else {
          setMockStatuses(prev => ({ ...prev, [s.id]: "processed" as any }))
        }
      }

      onProcessingChange(false)
      onIncorporated(newContent, allAccepted.length, commitSummary)
    } catch (error) {
      console.error("[v0] Failed to process suggestions:", error)
      onProcessingChange(false)
      // Fallback: apply changes manually
      let newContent = fileContent
      for (const s of allAccepted) {
        if (s.before && newContent.includes(s.before)) {
          newContent = newContent.replace(s.before, s.after)
        } else if (!s.before) {
          newContent = newContent.trimEnd() + "\n\n" + s.after + "\n"
        }
        // Mark as processed even in fallback
        if (s.id.startsWith("suggestion-")) {
          updateSuggestionStatus(s.id, "processed")
        } else {
          setMockStatuses(prev => ({ ...prev, [s.id]: "processed" as any }))
        }
      }
      onIncorporated(newContent, allAccepted.length, "")
    }
  }

  const handleSuggestChanges = () => {
    if (selectedFile && onOpenChat) {
      onOpenChat(selectedFile.name.replace(/\.md$/, ""))
    }
  }

  const handleAskQuestions = () => {
    if (selectedFile && onOpenChat) {
      // Open chat with document and a prompt asking AI to ask questions
      onOpenChat(selectedFile.name.replace(/\.md$/, ""), "ask-questions")
    }
  }

  const handleAnalyzeAll = async () => {
    setIsAnalyzing(true)
    setAnalyzeProgress(0)
    
    // Simulated analysis steps
    const steps = [
      "Reading context documents...",
      "Analyzing document relationships...",
      "Identifying potential improvements...",
      "Generating suggestions..."
    ]
    
    for (let i = 0; i < steps.length; i++) {
      setAnalyzeStep(steps[i])
      setAnalyzeProgress((i + 1) * 25)
      await new Promise(r => setTimeout(r, 750))
    }
    
    setIsAnalyzing(false)
    setAnalyzeProgress(0)
    setAnalyzeStep("")
    toast.success("Analysis complete. No new suggestions found.")
  }

  if (allSuggestions.length === 0 && acceptedIds.length === 0 && deferredCount === 0) {
    // Show analyzing progress UI
    if (isAnalyzing) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-6">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Analyzing Documents</p>
            <p className="text-sm text-muted-foreground">{analyzeStep}</p>
          </div>
          <div className="w-full max-w-xs space-y-2">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${analyzeProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{analyzeProgress}% complete</p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No suggestions yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Generate suggestions for this document using one of the options below.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3 h-auto py-3 px-4"
            onClick={handleSuggestChanges}
          >
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <MessageSquarePlus className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">Suggest Changes</p>
              <p className="text-xs text-muted-foreground">Open prompt with this document</p>
            </div>
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3 h-auto py-3 px-4"
            onClick={handleAnalyzeAll}
          >
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <ScanSearch className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">Analyze All Documents</p>
              <p className="text-xs text-muted-foreground">Find improvements across context</p>
            </div>
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3 h-auto py-3 px-4"
            onClick={handleAskQuestions}
          >
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <HelpCircle className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">Ask me Questions</p>
              <p className="text-xs text-muted-foreground">Prompt me to complete the document</p>
            </div>
          </Button>
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

      {/* Suggestions list - change tracking style */}
      <div className="flex-1 overflow-y-auto">
        {allSuggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
            <Check className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium">All suggestions reviewed</p>
            <p className="text-sm text-muted-foreground">
              {acceptedIds.length > 0
                ? `${acceptedIds.length} accepted. Click "Process Suggestions" below.`
                : "No suggestions were accepted."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {allSuggestions.map((suggestion) => (
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

      {/* Footer with Process button */}
      <div className="border-t px-4 py-3 bg-background">
        <Button
          className="w-full"
          onClick={handleProcessSuggestions}
          disabled={acceptedIds.length === 0 || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Process Suggestions
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
  return (
    <div className="flex flex-col border-b last:border-b-0">
      {/* Header row: badge + summary + actions */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Left: badge + summary */}
        <div className="flex-1 min-w-0">
          <Badge variant="outline" className="text-xs font-medium bg-muted border-muted text-muted-foreground mb-1.5">
            {TYPE_CONFIG[suggestion.type].label}
          </Badge>
          <p className="text-sm leading-snug">{suggestion.summary}</p>
        </div>

        {/* Right: action buttons + expand */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={onAccept}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-2.5"
          >
            <Check className="h-3 w-3" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            className="h-7 text-xs px-2.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3 w-3" />
            Discard
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDefer}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Save for later"
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>
          <button
            onClick={onToggleExpand}
            className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t pt-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{suggestion.detail}</p>

          {/* Diff view */}
          <div className="flex flex-col text-xs font-mono rounded-md overflow-hidden border">
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
              <pre className="px-3 py-2.5 text-emerald-800 dark:text-emerald-300 whitespace-pre-wrap leading-relaxed font-sans">
                {renderMarkdownAsText(suggestion.after)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
