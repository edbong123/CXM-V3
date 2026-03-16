"use client"

import { useState, useEffect } from "react"
import { useGitHub } from "@/contexts/github-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2, FolderGit2, Check, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProjectSettingsDialogProps {
  open: boolean
  onClose: () => void
  projectId: string | null
}

export function ProjectSettingsDialog({ open, onClose, projectId }: ProjectSettingsDialogProps) {
  const { projects, token, user, updateProject } = useGitHub()
  
  const project = projects.find(p => p.id === projectId)
  
  const [repos, setRepos] = useState<{ full_name: string; description: string | null }[]>([])
  const [selectedRepo, setSelectedRepo] = useState("")
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load repos when dialog opens
  useEffect(() => {
    if (open && token && user) {
      setIsLoadingRepos(true)
      setError(null)
      fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setRepos(data.map((r: any) => ({ full_name: r.full_name, description: r.description })))
          }
        })
        .catch(() => setError("Failed to load repositories"))
        .finally(() => setIsLoadingRepos(false))
    }
  }, [open, token, user])

  // Set initial selection when project loads
  useEffect(() => {
    if (project) {
      setSelectedRepo(project.repo)
    }
  }, [project])

  const handleSave = async () => {
    if (!projectId || !selectedRepo || selectedRepo === project?.repo) {
      onClose()
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      // Verify the repo exists and is accessible
      const res = await fetch(`https://api.github.com/repos/${selectedRepo}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      })

      if (!res.ok) {
        throw new Error("Repository not found or not accessible")
      }

      // Update the project
      updateProject(projectId, { 
        repo: selectedRepo,
        contextFolderReady: false,
        llmsTxtReady: false
      })

      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update repository")
    } finally {
      setIsSaving(false)
    }
  }

  if (!project) return null

  const hasChanges = selectedRepo !== project.repo

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-primary" />
            Project Settings
          </DialogTitle>
          <DialogDescription>
            Configure settings for this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current project info */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground mb-1">Current Project</p>
            <p className="font-medium">{project.repo.split('/')[1]}</p>
            <p className="text-xs text-muted-foreground">{project.repo}</p>
          </div>

          {/* Repository selection */}
          <div className="space-y-2">
            <Label>Repository</Label>
            {isLoadingRepos ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading repositories...
              </div>
            ) : (
              <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a repository" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {repos.map((repo) => (
                    <SelectItem key={repo.full_name} value={repo.full_name}>
                      <div className="flex flex-col">
                        <span>{repo.full_name}</span>
                        {repo.description && (
                          <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                            {repo.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Changing the repository will reset context folder and llms.txt status.
            </p>
          </div>

          {/* Status indicators */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Setup Status</Label>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-sm">
                {project.contextFolderReady ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                )}
                <span className={cn(
                  project.contextFolderReady ? "text-foreground" : "text-muted-foreground"
                )}>
                  /context/ folder
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {project.llmsTxtReady ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                )}
                <span className={cn(
                  project.llmsTxtReady ? "text-foreground" : "text-muted-foreground"
                )}>
                  llms.txt file
                </span>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
