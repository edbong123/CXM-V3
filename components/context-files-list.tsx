"use client"

import { useState } from "react"
import { FileText, RefreshCw, Plus, Loader2, FolderOpen } from "lucide-react"
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

  return (
    <aside className="flex flex-col h-full w-[260px] min-w-[260px] border-r bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">context/</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fetchFiles}
            disabled={isLoadingFiles}
            title="Refresh files"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoadingFiles && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCreateOpen(true)}
            title="New file"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {isLoadingFiles ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Loading files...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No markdown files found in context/</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New file
            </Button>
          </div>
        ) : (
          files.map((file) => {
            const suggestions = getSuggestionsForFile(file.name)
            const isSelected = selectedFile?.path === file.path
            return (
              <button
                key={file.path}
                onClick={() => selectFile(file)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-4 py-2 text-left transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  isSelected
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-sidebar-foreground"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm truncate">{file.name.replace(/\.md$/, "")}</span>
                </div>
                {suggestions.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-[20px] px-1.5 text-xs shrink-0 bg-primary/10 text-primary hover:bg-primary/10"
                  >
                    {suggestions.length}
                  </Badge>
                )}
              </button>
            )
          })
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
