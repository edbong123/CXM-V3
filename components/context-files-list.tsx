"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useGitHub } from "@/contexts/github-context"
import { useSuggestions } from "@/contexts/suggestions-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Loader2, Plus, FileText, MoreHorizontal, Trash2, RefreshCw } from "lucide-react"
import { createFile, deleteFile, fetchLlmsTxt } from "@/lib/github-client"

interface ContextFilesListProps {
  onNewChat?: () => void
  onFileSelect?: () => void
  onOpenSettings?: () => void
  onAddProject?: () => void
  onOpenProjectSettings?: () => void
}

export function ContextFilesList({
  onNewChat,
  onFileSelect,
  onOpenSettings,
  onAddProject,
  onOpenProjectSettings,
}: ContextFilesListProps) {
  const { contextFiles = [], isLoading: isLoadingFiles, refreshFiles, selectedFile, selectFile, token, activeProject } = useGitHub()
  const [llmsFile, setLlmsFile] = useState<any>(null)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newFileName, setNewFileName] = useState("")
  const repo = activeProject?.repo || ""
  const { getSuggestionsForFile: getContextSuggestions } = useSuggestions()

  // Load llms.txt on mount and when repo changes
  useEffect(() => {
    if (token && repo) {
      fetchLlmsTxt(token, repo)
        .then(file => setLlmsFile(file || null))
        .catch(() => setLlmsFile(null))
    } else {
      setLlmsFile(null)
    }
  }, [token, repo])

  const sortedFiles = contextFiles

  const getSuggestionCount = (fileName: string) => {
    const suggestions = getContextSuggestions(fileName)
    return suggestions?.length || 0
  }

  const handleDelete = async (file: any) => {
    if (!token || !repo) return
    setDeletingPath(file.path)
    try {
      await deleteFile(token, repo, file.path)
      await refreshFiles()
    } finally {
      setDeletingPath(null)
    }
  }

  const handleCreateFile = async () => {
    if (!newFileName.trim() || !token || !repo) return
    const fileName = newFileName.endsWith(".md") ? newFileName : `${newFileName}.md`
    try {
      await createFile(token, repo, `context/${fileName}`, "")
      setNewFileName("")
      setCreateOpen(false)
      await refreshFiles()
    } catch (err) {
      console.error("Failed to create file:", err)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Context Files</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => refreshFiles()}
            disabled={isLoadingFiles}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoadingFiles && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* LLMS File - Separate section above context files */}
      {llmsFile && (
        <div className="px-2 py-3 border-b border-border/30">
          <div
            className={cn(
              "group flex items-center rounded-md transition-colors",
              selectedFile?.path === llmsFile.path
                ? "bg-accent text-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <button
              onClick={() => {
                selectFile(llmsFile)
                onFileSelect?.()
              }}
              className="flex-1 flex items-center gap-2.5 px-3 py-1.5 text-left min-w-0"
            >
              <FileText
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  selectedFile?.path === llmsFile.path ? "text-primary" : "text-muted-foreground/60"
                )}
              />
              <span className="text-sm truncate font-medium">LLMS</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="shrink-0 mr-1.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  onClick={e => e.stopPropagation()}
                >
                  {deletingPath === llmsFile.path ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDelete(llmsFile)}>
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

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
                    <FileText
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isSelected ? "text-primary" : "text-muted-foreground/60"
                      )}
                    />
                    <span className="text-sm truncate">{displayName}</span>
                  </button>

                  {suggestionCount > 0 && (
                    <span
                      className={cn(
                        "shrink-0 mr-1 text-xs font-medium tabular-nums px-1.5 py-0.5 rounded-full",
                        isSelected
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground group-hover:bg-accent-foreground/10"
                      )}
                    >
                      {suggestionCount}
                    </span>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="shrink-0 mr-1.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        )}
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
            <DialogTitle>Create New File</DialogTitle>
            <DialogDescription>Enter a name for the new context file</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="filename"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFile()
              }}
              autoFocus
            />
            <Button onClick={handleCreateFile}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
