"use client"

import { useState } from "react"
import { FileText, Plus, Loader2, RefreshCw, MessageCircle, ListTodo, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { createFile } from "@/lib/github-client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface ContextFilesListProps {
  onNewChat: () => void
  onFileSelect?: () => void
}

export function ContextFilesList({ onNewChat, onFileSelect }: ContextFilesListProps) {
  const { files, llmFile, isLoadingFiles, fetchFiles, selectedFile, selectFile, token, repo } = useGitHub()

  const [createOpen, setCreateOpen] = useState(false)
  const [newFileName, setNewFileName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

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

  // Files displayed in order as provided
  const sortedFiles = files

  return (
    <aside className="flex flex-col h-full w-[240px] min-w-[240px] bg-sidebar border-r">

      {/* New Chat button */}
      <div className="px-2 pt-3 pb-1">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 h-8 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground font-normal px-3"
          onClick={onNewChat}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          New Chat
        </Button>
      </div>

      {/* LLM.txt - always at top */}
      {llmFile && (
        <div className="px-2 pb-1">
          <div className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-accent/40 transition-colors group">
            <button
              onClick={() => {
                selectFile(llmFile)
                onFileSelect?.()
              }}
              className={cn(
                "flex-1 flex items-center gap-2.5 rounded-md px-2 py-1 text-left transition-colors",
                selectedFile?.path === llmFile.path
                  ? "bg-accent text-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <ListTodo className={cn(
                "h-3.5 w-3.5 shrink-0",
                selectedFile?.path === llmFile.path ? "text-primary" : "text-muted-foreground/60"
              )} />
              <span className="text-sm truncate font-medium">LLM</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                // Update action will be defined later
              }}
              className="rounded p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
              title="Update LLM"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Context Files Header */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
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
          <div className="flex flex-col px-2 pb-3">
            {sortedFiles.map((file) => {
              const isSelected = selectedFile?.path === file.path
              const displayName = file.name.replace(/\.md$/, "")

              return (
                <button
                  key={file.path}
                  onClick={() => {
                    selectFile(file)
                    onFileSelect?.()
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-md px-3 py-1.5 text-left transition-colors",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <FileText className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isSelected ? "text-primary" : "text-muted-foreground/60"
                  )} />
                  <span className="text-sm truncate">{displayName}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

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
                  placeholder="my-context"
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
