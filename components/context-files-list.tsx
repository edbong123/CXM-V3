"use client"

import { useState } from "react"
import { FileText, Plus, Loader2, List, RefreshCw, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { getSuggestionsForFile } from "@/lib/mock-suggestions"
import { createFile } from "@/lib/github-client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function ContextFilesList() {
  const { files, isLoadingFiles, fetchFiles, selectedFile, selectFile, token, repo } = useGitHub()

  const [createOpen, setCreateOpen] = useState(false)
  const [newFileName, setNewFileName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessage, setChatMessage] = useState("")
  const [selectedChatFile, setSelectedChatFile] = useState<string | null>(null)
  const [showFileSelector, setShowFileSelector] = useState(false)

  const handleCreate = async () => {
    const name = newFileName.trim().replace(/[^a-zA-Z0-9._-]/g, "-")
    if (!name) return
    const fileName = name.endsWith(".md") ? name : `${name}.md`
    setIsCreating(true)
    try {
      await createFile(token, repo, `context/${fileName}`, `# ${fileName.replace(".md", "")}\n\n`, `docs: create ${fileName}`)
      await fetchFiles()
      setCreateOpen(false)
      setNewFileName("")
      toast.success(`Created ${fileName}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create file.")
    } finally {
      setIsCreating(false)
    }
  }

  // Sort: README first, then alphabetical
  const sortedFiles = [...files].sort((a, b) => {
    const aIsReadme = /^readme/i.test(a.name)
    const bIsReadme = /^readme/i.test(b.name)
    if (aIsReadme && !bIsReadme) return -1
    if (!aIsReadme && bIsReadme) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <aside className="flex flex-col h-full w-[240px] min-w-[240px] bg-sidebar border-r">

      {/* New Chat button */}
      <div className="px-3 pt-4 pb-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 h-9 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground font-normal"
          onClick={() => setChatOpen(true)}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          New Chat
        </Button>
      </div>

      {/* Divider */}
      <div className="h-px bg-border mx-2 mb-2" />
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Context Files
        </p>
        <div className="flex items-center gap-0.5 -mr-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setCreateOpen(true)}
            title="New file"
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={fetchFiles}
            disabled={isLoadingFiles}
            title="Refresh"
          >
            <RefreshCw className={cn("h-3 w-3", isLoadingFiles && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingFiles ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : sortedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-5 text-center gap-3">
            <FileText className="h-7 w-7 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground leading-snug">No files found in context/</p>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              New file
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 px-2 pb-4">
            {sortedFiles.map((file) => {
              const isReadme = /^readme/i.test(file.name)
              const suggestions = getSuggestionsForFile(file.name)
              const isSelected = selectedFile?.path === file.path
              const displayName = file.name.replace(/\.md$/, "")

  const handleSendChat = () => {
    if (!chatMessage.trim()) return
    // TODO: Integrate with AI chat API
    // For now, just show a toast
    toast.success(`Chat sent${selectedChatFile ? ` with ${selectedChatFile}` : ""}`)
    setChatMessage("")
    setSelectedChatFile(null)
    setChatOpen(false)
  }

  return (
                <button
                  key={file.path}
                  onClick={() => selectFile(file)}
                  className={cn(
                    "group w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isReadme ? (
                      <List className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )} />
                    ) : (
                      <FileText className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isSelected ? "text-primary" : "text-muted-foreground/60"
                      )} />
                    )}
                    <span className={cn(
                      "text-sm truncate",
                      isReadme && "font-medium"
                    )}>
                      {displayName}
                    </span>
                  </div>
                  {suggestions.length > 0 && (
                    <span className={cn(
                      "shrink-0 min-w-[18px] h-[18px] rounded-full text-xs flex items-center justify-center font-medium px-1.5",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {suggestions.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Chat dialog */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Chat</DialogTitle>
            <DialogDescription>
              {selectedChatFile ? `Chatting with ${selectedChatFile}` : "Ask a question or request assistance"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            {/* File selector */}
            {!selectedChatFile ? (
              <div className="flex flex-col gap-1.5">
                <Label>Context File (optional)</Label>
                <Button
                  variant="outline"
                  className="justify-start gap-2 h-9 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  onClick={() => setShowFileSelector(!showFileSelector)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Select file
                </Button>
                {showFileSelector && (
                  <div className="max-h-40 overflow-y-auto border rounded-md">
                    {sortedFiles.map(file => (
                      <button
                        key={file.path}
                        onClick={() => {
                          setSelectedChatFile(file.name.replace(/\.md$/, ""))
                          setShowFileSelector(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-b-0"
                      >
                        {file.name.replace(/\.md$/, "")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="flex-1">
                  {selectedChatFile}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedChatFile(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Message input */}
            <div className="flex flex-col gap-1.5">
              <Label>Message</Label>
              <textarea
                placeholder="Type your message..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    handleSendChat()
                  }
                }}
                className="flex-1 w-full px-3 py-2 text-sm border rounded-md bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setChatOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSendChat} disabled={!chatMessage.trim()}>
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create file dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Context File</DialogTitle>
            <DialogDescription>Creates a new markdown file in the context/ folder.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex flex-col gap-1.5">
              <Label>File name</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground font-mono">context/</span>
                <Input
                  placeholder="my-context.md"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="font-mono text-sm"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setCreateOpen(false); setNewFileName("") }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={!newFileName.trim() || isCreating}>
                {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Create File
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
