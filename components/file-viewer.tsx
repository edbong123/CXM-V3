"use client"

import { useState, useEffect } from "react"
import { Loader2, Save, X, Clock, FileText, ExternalLink, GitCommit, AlertTriangle, RotateCcw, Check } from "lucide-react"
import { fetchCommitHistory, type CommitInfo } from "@/lib/github-client"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useGitHub } from "@/contexts/github-context"
import { SuggestionsPanel } from "@/components/suggestions-panel"
import { SimpleWysiwyg } from "@/components/simple-wysiwyg"
import { getSuggestionsForFile as getMockSuggestionsForFile } from "@/lib/mock-suggestions"
import { useSuggestions } from "@/contexts/suggestions-context"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Tab = "view" | "edit" | "suggestions" | "history"

export function FileViewer({ onOpenChat }: { onOpenChat?: (file: string, mode?: "suggest" | "ask-questions") => void }) {
  const { 
    selectedFile, fileContent, isLoadingContent, commitChanges, isCommitting, token, repo,
    isReviewMode, setIsReviewMode, pendingFileSelect, setPendingFileSelect, forceSelectFile
  } = useGitHub()

  const { getSuggestionsForFile: getContextSuggestions } = useSuggestions()

  const [activeTab, setActiveTab] = useState<Tab>("view")
  const [editContent, setEditContent] = useState("")
  const [isDirty, setIsDirty] = useState(false)
  const [commitDialogOpen, setCommitDialogOpen] = useState(false)
  const [commitMessage, setCommitMessage] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Review mode content (shared isReviewMode state is in context)
  const [reviewContent, setReviewContent] = useState("")
  const [acceptedCount, setAcceptedCount] = useState(0)

  // History state
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  // Sync edit content when file loads
  useEffect(() => {
    setEditContent(fileContent)
    setIsDirty(false)
  }, [fileContent])

  // Fetch commit history when switching to history tab or when file changes
  useEffect(() => {
    if (activeTab !== "history" || !selectedFile || !token || !repo) return
    
    setIsLoadingHistory(true)
    setHistoryError(null)
    
    fetchCommitHistory(token, repo, selectedFile.path)
      .then((data) => {
        setCommits(data)
        setIsLoadingHistory(false)
      })
      .catch((err) => {
        setHistoryError(err.message)
        setIsLoadingHistory(false)
      })
  }, [activeTab, selectedFile, token, repo])

  const handleEditChange = (val: string) => {
    setEditContent(val)
    setIsDirty(val !== fileContent)
  }

  const handleDiscard = () => {
    setEditContent(fileContent)
    setIsDirty(false)
  }

  const handleSave = async () => {
    if (!commitMessage.trim()) return
    const ok = await commitChanges(editContent, commitMessage)
    if (ok) {
      toast.success("Changes committed to GitHub.")
      setIsDirty(false)
      setCommitDialogOpen(false)
      setCommitMessage("")
    } else {
      toast.error("Failed to commit changes.")
    }
  }

  const handleIncorporated = (newContent: string, count: number) => {
    setReviewContent(newContent)
    setAcceptedCount(count)
    setIsReviewMode(true)
  }

  const handleApplyReview = () => {
    setEditContent(reviewContent)
    setIsDirty(reviewContent !== fileContent)
    setIsReviewMode(false)
    setActiveTab("edit")
    toast.success("Changes applied. Review and save when ready.")
  }

  const handleDiscardReview = () => {
    setReviewContent("")
    setAcceptedCount(0)
    setIsReviewMode(false)
    setActiveTab("view")
    setPendingFileSelect(null)
    toast.info("Review discarded. Original file unchanged.")
  }

  // State for save/discard confirmation dialog
  const [saveDiscardDialogOpen, setSaveDiscardDialogOpen] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<{ type: "tab", value?: Tab } | null>(null)

  // Watch for pending file selections from sidebar clicks
  useEffect(() => {
    if (pendingFileSelect && isReviewMode) {
      setSaveDiscardDialogOpen(true)
    }
  }, [pendingFileSelect, isReviewMode])

  const handleTabChange = (newTab: Tab) => {
    if (isReviewMode && newTab !== activeTab) {
      setPendingNavigation({ type: "tab", value: newTab })
      setSaveDiscardDialogOpen(true)
      return
    }
    setActiveTab(newTab)
  }

  const confirmDiscard = () => {
    const pendingFile = pendingFileSelect
    // Clear review state
    setReviewContent("")
    setAcceptedCount(0)
    setIsReviewMode(false)
    setSaveDiscardDialogOpen(false)
    setPendingNavigation(null)
    setPendingFileSelect(null)
    // Handle the pending action
    if (pendingFile) {
      forceSelectFile(pendingFile)
    } else if (pendingNavigation?.type === "tab" && pendingNavigation.value) {
      setActiveTab(pendingNavigation.value)
    } else {
      setActiveTab("view")
    }
    toast.info("Changes discarded.")
  }

  const confirmSave = () => {
    // Apply review content and open commit dialog
    setEditContent(reviewContent)
    setIsDirty(true)
    setIsReviewMode(false)
    setCommitDialogOpen(true)
    setSaveDiscardDialogOpen(false)
    setPendingNavigation(null)
    setPendingFileSelect(null)
  }

  const cancelSaveDiscard = () => {
    setSaveDiscardDialogOpen(false)
    setPendingNavigation(null)
    setPendingFileSelect(null)
  }

  const mockSuggestions = selectedFile ? getMockSuggestionsForFile(selectedFile.name) : []
  // Only count pending suggestions from context (not rejected/later)
  const contextSuggestions = selectedFile ? getContextSuggestions(selectedFile.name, ["pending"]) : []
  const suggestions = [...mockSuggestions, ...contextSuggestions]

  if (!selectedFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <FileText className="h-6 w-6 text-muted-foreground/60" />
        </div>
        <div>
          <p className="font-medium">No file selected</p>
          <p className="text-sm text-muted-foreground mt-1">
            Select a file from the sidebar to view and edit its contents.
          </p>
        </div>
      </div>
    )
  }

  if (isLoadingContent) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading {selectedFile.name.replace(/\.md$/, "")}...</span>
      </div>
    )
  }

  const tabsDisabled = isProcessing || isReviewMode

  // Review Mode UI - shown after processing suggestions
  if (isReviewMode) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Review mode header */}
        <div className="border-b">
          {/* Top bar with file info */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded bg-primary/10 flex items-center justify-center">
                <FileText className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{selectedFile?.name.replace(/\.md$/, "")}</p>
                <p className="text-xs text-muted-foreground">Updated version</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs font-medium">
              {acceptedCount} change{acceptedCount !== 1 ? "s" : ""} applied
            </Badge>
          </div>
          
          {/* Warning banner */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-200/50 dark:border-amber-800/30">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Review the changes below. Saving will overwrite the current document.
            </p>
          </div>
        </div>

        {/* Editor with review content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full p-4">
            <div className="h-full rounded-lg border shadow-sm overflow-hidden bg-card">
              <SimpleWysiwyg
                value={reviewContent}
                onChange={setReviewContent}
                placeholder="Document content..."
                className="h-full border-0"
              />
            </div>
          </div>
        </div>

        {/* Review mode footer */}
        <div className="border-t px-4 py-3 bg-muted/20 flex items-center justify-end gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDiscardReview}
          >
            <X className="h-3.5 w-3.5" />
            Discard
          </Button>
          <Button 
            size="sm" 
            onClick={() => {
              setEditContent(reviewContent)
              setIsDirty(true)
              setIsReviewMode(false)
              setCommitDialogOpen(true)
            }}
          >
            <Save className="h-3.5 w-3.5" />
            Update Context
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <div className="text-center">
              <p className="font-medium text-sm">Generating new version of the document based on the accepted suggestions:</p>
              <p className="text-xs text-muted-foreground mt-1">Applying accepted suggestions to file...</p>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => !isProcessing && handleTabChange(v as Tab)} className="flex flex-col h-full">
        {/* Tab bar */}
        <div className="flex items-center justify-between border-b px-4 py-0 bg-background shrink-0">
          <TabsList className="h-10 bg-transparent gap-0 rounded-none p-0">
            {(["view", "edit", "suggestions", "history"] as Tab[]).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                disabled={tabsDisabled}
                className={cn(
                  "relative h-10 rounded-none border-b-2 border-transparent px-4 text-sm font-medium capitalize",
                  "data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent",
                  "text-muted-foreground data-[state=active]:text-foreground",
                  "hover:text-foreground transition-colors",
                  tabsDisabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {tab === "suggestions" && suggestions.length > 0 ? (
                  <span className="flex items-center gap-1.5">
                    Suggestions
                    <Badge variant="secondary" className="h-4.5 px-1.5 text-xs">
                      {suggestions.length}
                    </Badge>
                  </span>
                ) : tab === "history" ? (
                  <span className="flex items-center gap-1.5">
                    History
                    {commits.length > 0 && (
                      <Badge variant="secondary" className="h-4.5 px-1.5 text-xs">
                        {commits.length}
                      </Badge>
                    )}
                  </span>
                ) : (
                  <span className="capitalize">{tab}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* File name */}
          <span className="text-xs font-mono text-muted-foreground hidden md:block">
            {selectedFile.name.replace(/\.md$/, "")}
          </span>
        </div>

        {/* View Tab */}
        <TabsContent value="view" className="flex-1 overflow-y-auto m-0 p-6">
          <article className="prose prose-sm max-w-none">
            <MarkdownPreview content={fileContent} />
          </article>
        </TabsContent>

        {/* Edit Tab */}
        <TabsContent value="edit" className="flex-1 overflow-hidden m-0 flex flex-col">
          <div className="flex-1 overflow-hidden p-4">
            <SimpleWysiwyg
              value={editContent}
              onChange={handleEditChange}
              placeholder="Start writing..."
              className="h-full"
            />
          </div>

          {/* Save/Discard bar */}
          {isDirty && (
            <div className="border-t px-4 py-3 flex items-center justify-between bg-muted/30 shrink-0">
              <span className="text-xs text-muted-foreground">Unsaved changes</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDiscard}>
                  <X className="h-3.5 w-3.5" />
                  Discard
                </Button>
                <Button size="sm" onClick={() => setCommitDialogOpen(true)}>
                  <Save className="h-3.5 w-3.5" />
                  Save & Commit
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Suggestions Tab */}
        <TabsContent value="suggestions" className="flex-1 overflow-hidden m-0">
          <SuggestionsPanel
            onIncorporated={handleIncorporated}
            onProcessingChange={setIsProcessing}
            isProcessing={isProcessing}
            onOpenChat={onOpenChat}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="flex-1 overflow-y-auto m-0">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Loading commit history...</span>
            </div>
          ) : historyError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-sm">Failed to load history</p>
                <p className="text-sm text-muted-foreground mt-1">{historyError}</p>
              </div>
            </div>
          ) : commits.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Clock className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <div>
                <p className="font-medium text-sm">No commit history</p>
                <p className="text-sm text-muted-foreground mt-1">This file has no commits yet.</p>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="space-y-0">
                {commits.map((commit, idx) => (
                  <div
                    key={commit.sha}
                    className="relative pl-6 pb-6 last:pb-0 group"
                  >
                    {/* Timeline line */}
                    {idx < commits.length - 1 && (
                      <div className="absolute left-[9px] top-5 bottom-0 w-px bg-border" />
                    )}
                    {/* Timeline dot */}
                    <div className="absolute left-0 top-1 h-[18px] w-[18px] rounded-full border-2 border-border bg-background flex items-center justify-center">
                      <GitCommit className="h-2.5 w-2.5 text-muted-foreground" />
                    </div>
                    {/* Content */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm font-medium leading-tight">
                          {commit.message.split("\n")[0]}
                        </p>
                        <a
                          href={commit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        >
                          <code className="font-mono">{commit.sha.slice(0, 7)}</code>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {commit.author.avatar_url && (
                          <img
                            src={commit.author.avatar_url}
                            alt={commit.author.name}
                            className="h-4 w-4 rounded-full"
                          />
                        )}
                        <span>{commit.author.login || commit.author.name}</span>
                        <span>·</span>
                        <time dateTime={commit.date}>
                          {formatRelativeDate(commit.date)}
                        </time>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Commit dialog */}
      <Dialog open={commitDialogOpen} onOpenChange={setCommitDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Commit Changes</DialogTitle>
            <DialogDescription>
              Enter a commit message to save changes to{" "}
              <span className="font-mono text-foreground">{selectedFile.name.replace(/\.md$/, "")}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex flex-col gap-1.5">
              <Label>Commit message</Label>
              <Input
                placeholder="docs: update context file"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setCommitDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!commitMessage.trim() || isCommitting}
              >
                {isCommitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Commit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save or discard confirmation dialog */}
      <Dialog open={saveDiscardDialogOpen} onOpenChange={setSaveDiscardDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes from processed suggestions. Would you like to save or discard them?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={cancelSaveDiscard}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={confirmDiscard}
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={confirmSave}
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

function MarkdownPreview({ content }: { content: string }) {
  if (!content) {
    return <p className="text-muted-foreground italic">No content</p>
  }

  // Very simple markdown renderer for preview
  const lines = content.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const key = `md-${i}-${elements.length}`

    if (line.startsWith("### ")) {
      elements.push(<h3 key={key} className="text-base font-semibold mt-4 mb-1.5">{renderInline(line.slice(4))}</h3>)
      i++
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={key} className="text-lg font-semibold mt-5 mb-2">{renderInline(line.slice(3))}</h2>)
      i++
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={key} className="text-xl font-bold mt-0 mb-3">{renderInline(line.slice(2))}</h1>)
      i++
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = []
      const startLine = i
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <ul key={`list-${startLine}`} className="list-disc list-inside space-y-1 my-2">
          {items.map((item, j) => <li key={`li-${startLine}-${j}`} className="text-sm">{renderInline(item)}</li>)}
        </ul>
      )
    } else if (line.startsWith("```")) {
      const codeLines: string[] = []
      const startLine = i
      i++
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      i++ // Skip closing ```
      elements.push(
        <pre key={`code-${startLine}`} className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto my-3">
          <code>{codeLines.join("\n")}</code>
        </pre>
      )
    } else if (line.startsWith("|")) {
      // Table
      const tableLines: string[] = []
      const startLine = i
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i])
        i++
      }
      elements.push(<TableRenderer key={`table-${startLine}`} lines={tableLines} />)
    } else if (line.trim() === "") {
      elements.push(<div key={key} className="h-2" />)
      i++
    } else {
      elements.push(<p key={key} className="text-sm leading-relaxed my-1">{renderInline(line)}</p>)
      i++
    }
  }

  return <>{elements}</>
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="bg-muted px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>
    }
    return part
  })
}

function TableRenderer({ lines }: { lines: string[] }) {
  const rows = lines.map((l) => l.split("|").filter((_, i, a) => i > 0 && i < a.length - 1).map((c) => c.trim()))
  const [header, , ...body] = rows
  if (!header) return null
  return (
    <div className="overflow-x-auto my-3">
      <table className="text-sm w-full border-collapse">
        <thead>
          <tr className="border-b">
            {header.map((h, i) => <th key={i} className="text-left py-1.5 px-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {row.map((cell, j) => <td key={j} className="py-1.5 px-2 text-muted-foreground">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
