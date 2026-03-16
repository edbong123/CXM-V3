"use client"

import { useState } from "react"
import { Plus, Check, ChevronDown, Folder, Trash2, Settings, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useGitHub, type Project } from "@/contexts/github-context"
import { cn } from "@/lib/utils"

interface ProjectSelectorProps {
  onOpenSettings: () => void
  onAddProject: () => void
  onOpenProjectSettings: (projectId: string) => void
}

export function ProjectSelector({ onOpenSettings, onAddProject, onOpenProjectSettings }: ProjectSelectorProps) {
  const { user, projects, activeProject, setActiveProject, removeProject, fetchFiles } = useGitHub()
  const [isOpen, setIsOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  if (!user) return null

  const handleSelectProject = async (project: Project) => {
    if (project.id === activeProject?.id) {
      setIsOpen(false)
      return
    }
    setSwitching(true)
    setActiveProject(project)
    setIsOpen(false)
    // Fetch files for the new project
    setTimeout(async () => {
      await fetchFiles()
      setSwitching(false)
    }, 100)
  }

  const handleRemoveProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    removeProject(projectId)
  }

  const getRepoShortName = (repo: string) => {
    return repo.split("/")[1] || repo
  }

  return (
    <div className="px-2 py-2 border-b">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-between h-9 px-3 font-medium",
              "hover:bg-accent/60"
            )}
            disabled={switching}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Folder className="h-4 w-4 shrink-0 text-primary" />
              {switching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : activeProject ? (
                <span className="truncate text-sm">{getRepoShortName(activeProject.repo)}</span>
              ) : (
                <span className="text-sm text-muted-foreground">Select project</span>
              )}
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )} />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[220px]">
          {projects.length === 0 ? (
            <div className="px-2 py-3 text-center">
              <p className="text-sm text-muted-foreground mb-2">No projects yet</p>
              <Button size="sm" variant="outline" onClick={() => { setIsOpen(false); onAddProject() }}>
                <Plus className="h-3.5 w-3.5" />
                Add your first project
              </Button>
            </div>
          ) : (
            <>
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Projects
                </p>
              </div>
              {projects.map((project) => {
                const isActive = activeProject?.id === project.id
                const isReady = project.contextFolderReady && project.llmsTxtReady
                
                return (
                  <DropdownMenuItem
                    key={project.id}
                    className={cn(
                      "flex items-center justify-between gap-2 cursor-pointer group",
                      isActive && "bg-accent"
                    )}
                    onClick={() => handleSelectProject(project)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isActive ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : (
                        <div className="w-3.5" />
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm truncate">{getRepoShortName(project.repo)}</span>
                        {!isReady && (
                          <span className="text-[10px] text-amber-600">Setup incomplete</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); onOpenProjectSettings(project.id) }}
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Project settings"
                      >
                        <Settings className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => handleRemoveProject(e, project.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove project"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem onClick={() => { setIsOpen(false); onAddProject() }}>
            <Plus className="h-3.5 w-3.5" />
            Add Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
