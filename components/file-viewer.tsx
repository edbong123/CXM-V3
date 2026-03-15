"use client"

import { useState, useEffect } from "react"
import { Loader2, Save, X, Clock, FileText } from "lucide-react"
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
import { getSuggestionsForFile } from "@/lib/mock-suggestions"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Tab = "view" | "edit" | "suggestions" | "history"

export function FileViewer() {
  const { selectedFile, fileContent, isLoadingContent, commitChanges, isCommitting } = useGitHub()

  const [activeTab, setActiveTab] = useState<Tab>("view")
  const [editContent, setEditContent] = useState("")
  const [isDirty, setIsDirty] = useState(false)
  const [commitDialogOpen, setCommitDialogOpen] = useState(false)
  const [commitMessage, setCommitMessage] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Sync edit content when file loads
  useEffect(() => {
    setEditContent(fileContent)
    setIsDirty(false)
  }, [fileContent])

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

  const handleIncorporated = (newContent: string) => {
    setEditContent(newContent)
    setIsDirty(newContent !== fileContent)
    setActiveTab("edit")
    toast.success("Accepted suggestions incorporated into the file.")
  }

  const suggestions = selectedFile ? getSuggestionsForFile(selectedFile.name) : []

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

  const tabsDisabled = isProcessing

  return (
    <div className="flex flex-col h-full relative">
      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <div className="text-center">
              <p className="font-medium text-sm">Incorporating Changes</p>
              <p className="text-xs text-muted-foreground mt-1">Applying accepted suggestions to file...</p>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => !tabsDisabled && setActiveTab(v as Tab)} className="flex flex-col h-full">
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
                  <span className="flex items-center gap-1.5 text-muted-foreground/70">
                    History
                    <span className="text-xs opacity-60">(soon)</span>
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
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="flex-1 overflow-y-auto m-0">
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Clock className="h-5 w-5 text-muted-foreground/60" />
            </div>
            <div>
              <p className="font-medium text-sm">Commit history</p>
              <p className="text-sm text-muted-foreground mt-1">Coming soon — view and restore previous versions.</p>
            </div>
          </div>
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
    </div>
  )
}

function MarkdownPreview({ content }: { content: string }) {
  if (!content) {
    return <p className="text-muted-foreground italic">No content</p>
  }

  // Very simple markdown renderer for preview
  const lines = content.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0
  let keyCounter = 0

  while (i < lines.length) {
    const line = lines[i]
    const key = keyCounter++

    if (line.startsWith("### ")) {
      elements.push(<h3 key={key} className="text-base font-semibold mt-4 mb-1.5">{renderInline(line.slice(4))}</h3>)
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={key} className="text-lg font-semibold mt-5 mb-2">{renderInline(line.slice(3))}</h2>)
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={key} className="text-xl font-bold mt-0 mb-3">{renderInline(line.slice(2))}</h1>)
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <ul key={key} className="list-disc list-inside space-y-1 my-2">
          {items.map((item, j) => <li key={j} className="text-sm">{renderInline(item)}</li>)}
        </ul>
      )
      continue
    } else if (line.startsWith("```")) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <pre key={key} className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto my-3">
          <code>{codeLines.join("\n")}</code>
        </pre>
      )
    } else if (line.startsWith("|")) {
      // Table
      const tableLines: string[] = []
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i])
        i++
      }
      elements.push(<TableRenderer key={key} lines={tableLines} />)
      continue
    } else if (line.trim() === "") {
      elements.push(<div key={key} className="h-2" />)
    } else {
      elements.push(<p key={key} className="text-sm leading-relaxed my-1">{renderInline(line)}</p>)
    }
    i++
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
