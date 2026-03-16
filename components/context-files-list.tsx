"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useGitHub } from "@/contexts/github-context"
import { useSuggestions } from "@/contexts/suggestions-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileText, Plus, RefreshCw, MoreHorizontal, Trash2, Loader2, MessageSquare, Settings } from "lucide-react"
import { createFile, deleteFile, fetchLlmsTxt } from "@/lib/github-client"
import type { ContextFile } from "@/lib/github-client"

interface ContextFilesListProps {
  onNewChat?: () => void
  onFileSelect?: () => void
  onOpenSettings?: () => void
  onAddProject?: () => void
  onOpenProjectSettings?: () => void
}

export function ContextFilesList({ onNewChat, onFileSelect, onOpenSettings, onAddProject, onOpenProjectSettings }: ContextFilesListProps) {
  const { contextFiles = [], isLoading: isLoadingFiles, refreshFiles, selectedFile, selectFile, token, activeProject } = useGitHub()
  const [llmsFile, setLlmsFile] = useState<ContextFile | null>(null)
  const repo = activeProject?.repo || ""
  const { getSuggestionsForFile: getContextSuggestions } = useSuggestions()

  // Filter out llms.txt from context files list
  const files = contextFiles.filter(f => f.name !== 'llms.txt')
  const sortedFiles = files

  // Load llms.txt on mount and when repo changes
  useEffect(() => {
    if (token && repo) {
      fetchLlmsTxt(token, repo).then(file => setLlmsFile(file || null)).catch(() => setLlmsFile(null))
    } else {
      setLlmsFile(null)
    }
  }, [token, repo])

  const [createOpen, setCreateOpen] = useState(false)
  const [newFileName, setNewFileName] = useState("")
  const [creating, setCreating] = useState(false)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)

  const getSuggestionCount = (fileName: string) => {
    const suggestions = getContextSuggestions(fileName)
    return suggestions?.length || 0
  }

  const handleCreate = async () => {
    if (!newFileName.trim() || !token || !repo) return
    setCreating(true)
    try {
      const name = newFileName.trim().toUpperCase().replace(/\.md$/i, "") + ".md"
      await createFile(token, repo, `context/${name}`, `# ${name.replace(/\.md$/, "")}\n\n`)
      await refreshFiles()
      setCreateOpen(false)
      setNewFileName("")
    } catch (err) {
      console.error("Failed to create file:", err)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (file: ContextFile) => {
    if (!token || !repo) return
    setDeletingPath(file.path)
    try {
      await deleteFile(token, repo, file.path, file.sha || "")
      await refreshFiles()
      if (selectedFile?.path === file.path) {
        selectFile(null)
      }
    } catch (err) {
      console.error("Failed to delete file:", err)
    } finally {
      setDeletingPath(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* New Chat button */}
      <div className="px-3 pt-3 pb-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2.5 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-accent/60"
          onClick={onNewChat}
        >
          <MessageSquare className="h-4 w-4" />
          <span>New Chat</span>
        </Button>
      </div>

      {/* LLMS file - separate from context files */}
      {llmsFile && (
        <div className="px-3 pb-2">
          <div
            className={cn(
              "group flex items-center rounded-md transition-colors cursor-pointer",
              selectedFile?.path === llmsFile.path
                ? "bg-accent text-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-accent/60 hover:text-sidebar-foreground"
            )}
            onClick={() => {
              selectFile(llmsFile)
              onFileSelect?.()
            }}
          >
            <div className="flex-1 flex items-center gap-2.5 px-3 py-1.5 min-w-0">
              <FileText className={cn(
                "h-4 w-4 shrink-0",
                selectedFile?.path === llmsFile.path ? "text-primary" : "text-muted-foreground/60"
              )} />
              <span className="text-sm font-medium">LLMS</span>
            </div>
          </div>
        </div>
      )}

      {/* Context Files header */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Context Files</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCreateOpen(true)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            title="New file"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={refreshFiles}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
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
              const displayName = file.name.replace(/\.md$/, "").toUpperCase()
              const isDeleting = deletingPath === file.path
              const suggestionCount = getSuggestionCount(file.name)

              return (
                <div
                  key={file.path}
                  className={cn(
                    "group flex items-center rounded-md transition-colors",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <button
                    onClick={() => {
                      selectFile(file)
                      onFileSelect?.()
                    }}
                    className="flex-1 flex items-center gap-2.5 px-3 py-1.5 text-left min-w-0"
                  >
                    <FileText className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isSelected ? "text-primary" : "text-muted-foreground/60"
                    )} />
                    <span className="text-sm truncate">{displayName}</span>
                    {suggestionCount > 0 && (
                      <span className="ml-auto shrink-0 text-[10px] bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded-full">
                        {suggestionCount}
                      </span>
                    )}
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="shrink-0 mr-1.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        onClick={e => e.stopPropagation()}
                      >
                        {isDeleting
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <MoreHorizontal className="h-3.5 w-3.5" />
                        }
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDelete(file)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create file dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Context File</DialogTitle>
            <DialogDescription>
              Enter a name for the new context file.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="FILENAME"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newFileName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
