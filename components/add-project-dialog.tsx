"use client"

import { useState, useEffect, useRef } from "react"
import { 
  CheckCircle2, AlertCircle, Loader2, Github,
  ChevronDown, Search, Lock, FolderOpen, FileText,
  ChevronRight, Check
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useGitHub } from "@/contexts/github-context"
import { 
  fetchUserRepos, 
  checkContextFolderExists, 
  createContextFolder,
  checkLlmsTxtExists,
  createLlmsTxt,
  type GitHubRepo 
} from "@/lib/github-client"
import { cn } from "@/lib/utils"

interface AddProjectDialogProps {
  open: boolean
  onClose: () => void
}

type SetupStep = 1 | 2 | 3

const STEPS = [
  { num: 1, title: "Repository", desc: "Select a repository" },
  { num: 2, title: "Context Folder", desc: "Setup /context/ directory" },
  { num: 3, title: "Discovery File", desc: "Create llms.txt" },
]

export function AddProjectDialog({ open, onClose }: AddProjectDialogProps) {
  const {
    token, user,
    addProject, updateProject, setActiveProject, fetchFiles,
    error, clearError,
  } = useGitHub()

  const [currentStep, setCurrentStep] = useState<SetupStep>(1)
  const [localError, setLocalError] = useState<string | null>(null)

  // Repo picker state
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [reposError, setReposError] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedRepo, setSelectedRepo] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Project being created
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectId, setNewProjectId] = useState<string | null>(null)

  // Step 2 & 3 state
  const [contextFolderReady, setContextFolderReady] = useState(false)
  const [llmsTxtReady, setLlmsTxtReady] = useState(false)
  const [checkingContext, setCheckingContext] = useState(false)
  const [checkingLlms, setCheckingLlms] = useState(false)
  const [creatingContext, setCreatingContext] = useState(false)
  const [creatingLlms, setCreatingLlms] = useState(false)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep(1)
      setSelectedRepo("")
      setLocalError(null)
      setNewProjectId(null)
      setContextFolderReady(false)
      setLlmsTxtReady(false)
    }
  }, [open])

  // Load repos when dialog opens
  useEffect(() => {
    if (!open || !user || !token) { setRepos([]); return }
    setReposLoading(true)
    setReposError(null)
    fetchUserRepos(token)
      .then((r) => { setRepos(r); setReposLoading(false) })
      .catch((e) => { setReposError(e.message); setReposLoading(false) })
  }, [open, user, token])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filteredRepos = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelectRepo = async () => {
    if (!selectedRepo) return
    setCreatingProject(true)
    setLocalError(null)
    clearError()

    const project = await addProject(selectedRepo)
    if (!project) {
      setLocalError(error || "Failed to add project")
      setCreatingProject(false)
      return
    }

    setNewProjectId(project.id)
    setContextFolderReady(project.contextFolderReady)
    setLlmsTxtReady(project.llmsTxtReady)
    setCreatingProject(false)

    // Determine next step
    if (!project.contextFolderReady) {
      setCurrentStep(2)
    } else if (!project.llmsTxtReady) {
      setCurrentStep(3)
    } else {
      // Fully ready, activate and close
      setActiveProject(project)
      setTimeout(() => fetchFiles(), 100)
      onClose()
    }
  }

  const handleCreateContextFolder = async () => {
    if (!token || !selectedRepo || !newProjectId) return
    setCreatingContext(true)
    setLocalError(null)
    try {
      await createContextFolder(token, selectedRepo)
      setContextFolderReady(true)
      updateProject(newProjectId, { contextFolderReady: true })
      
      // Check llms.txt
      setCheckingLlms(true)
      const llmsExists = await checkLlmsTxtExists(token, selectedRepo)
      setLlmsTxtReady(llmsExists)
      setCheckingLlms(false)

      if (!llmsExists) {
        setCurrentStep(3)
      } else {
        updateProject(newProjectId, { llmsTxtReady: true })
        // Fully ready
        const project = { id: newProjectId, repo: selectedRepo, contextFolderReady: true, llmsTxtReady: true, createdAt: Date.now() }
        setActiveProject(project)
        setTimeout(() => fetchFiles(), 100)
        onClose()
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Failed to create context folder")
    } finally {
      setCreatingContext(false)
    }
  }

  const handleCreateLlmsTxt = async () => {
    if (!token || !selectedRepo || !newProjectId) return
    setCreatingLlms(true)
    setLocalError(null)
    try {
      await createLlmsTxt(token, selectedRepo)
      setLlmsTxtReady(true)
      updateProject(newProjectId, { llmsTxtReady: true })
      
      // Fully ready
      const project = { id: newProjectId, repo: selectedRepo, contextFolderReady: true, llmsTxtReady: true, createdAt: Date.now() }
      setActiveProject(project)
      setTimeout(() => fetchFiles(), 100)
      onClose()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Failed to create llms.txt")
    } finally {
      setCreatingLlms(false)
    }
  }

  const handleSkipAndFinish = () => {
    if (!newProjectId) return
    const project = { 
      id: newProjectId, 
      repo: selectedRepo, 
      contextFolderReady, 
      llmsTxtReady, 
      createdAt: Date.now() 
    }
    setActiveProject(project)
    setTimeout(() => fetchFiles(), 100)
    onClose()
  }

  const displayError = localError || error

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5 text-foreground" />
            <DialogTitle className="font-serif">Add Project</DialogTitle>
          </div>
          <DialogDescription>
            Connect a repository as a new project for context management.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-2 py-3 border-b">
          {STEPS.map((step, idx) => {
            const isComplete = 
              (step.num === 1 && currentStep > 1) ||
              (step.num === 2 && contextFolderReady) ||
              (step.num === 3 && llmsTxtReady)
            const isCurrent = currentStep === step.num
            
            return (
              <div key={step.num} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    isComplete ? "bg-primary text-primary-foreground" :
                    isCurrent ? "bg-primary/20 text-primary border-2 border-primary" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {isComplete ? <Check className="h-4 w-4" /> : step.num}
                  </div>
                  <span className={cn(
                    "text-[10px] text-center max-w-16 leading-tight",
                    isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
                  )}>
                    {step.title}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground/50" />
                )}
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-4 pt-2">
          {/* Step 1: Repo Selection */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="text-sm font-medium mb-1">Select Repository</h3>
                <p className="text-xs text-muted-foreground">
                  Choose a repository to add as a project. Each project has its own context files.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen((o) => !o); setSearch("") }}
                    disabled={reposLoading}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2.5 text-sm transition-colors",
                      "hover:border-ring focus:outline-none focus:ring-2 focus:ring-ring",
                      !selectedRepo && "text-muted-foreground"
                    )}
                  >
                    <span className={cn("truncate font-mono", selectedRepo ? "text-foreground" : "text-muted-foreground")}>
                      {reposLoading ? "Loading repositories..." : selectedRepo || "Select a repository"}
                    </span>
                    {reposLoading
                      ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      : <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", dropdownOpen && "rotate-180")} />
                    }
                  </button>

                  {dropdownOpen && !reposLoading && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                      <div className="flex items-center gap-2 border-b px-3 py-2">
                        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search repositories..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto py-1">
                        {reposError && (
                          <div className="px-3 py-2 text-xs text-destructive">{reposError}</div>
                        )}
                        {!reposError && filteredRepos.length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">No repositories found</div>
                        )}
                        {filteredRepos.map((r) => (
                          <button
                            key={r.full_name}
                            type="button"
                            onClick={() => {
                              setSelectedRepo(r.full_name)
                              clearError()
                              setDropdownOpen(false)
                            }}
                            className={cn(
                              "w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-accent",
                              selectedRepo === r.full_name && "bg-accent"
                            )}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="font-mono text-sm truncate">{r.full_name}</span>
                              {r.description && (
                                <span className="text-xs text-muted-foreground truncate">{r.description}</span>
                              )}
                            </div>
                            {r.private && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSelectRepo}
                  disabled={!selectedRepo.trim() || creatingProject}
                >
                  {creatingProject ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding project...
                    </>
                  ) : "Add & Continue"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Context Folder */}
          {currentStep === 2 && !contextFolderReady && (
            <div className="flex flex-col gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Repository: {selectedRepo}</span>
                </div>
                <h3 className="text-sm font-medium mb-1">Context Directory</h3>
                <p className="text-xs text-muted-foreground">
                  Context files need a dedicated <code className="bg-muted px-1 rounded">/context/</code> folder.
                </p>
              </div>

              <div className="flex items-center gap-3 p-4 border rounded-lg bg-background">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">/context/</p>
                  <p className="text-xs text-muted-foreground">
                    {checkingContext ? "Checking..." : "Folder not found"}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleCreateContextFolder}
                  disabled={creatingContext || checkingContext}
                >
                  {creatingContext || checkingContext ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : "Create"}
                </Button>
              </div>

              <Button variant="ghost" size="sm" onClick={handleSkipAndFinish}>
                Skip for now
              </Button>
            </div>
          )}

          {/* Step 3: llms.txt */}
          {currentStep === 3 && !llmsTxtReady && (
            <div className="flex flex-col gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">/context/ ready</span>
                </div>
                <h3 className="text-sm font-medium mb-1">Discovery File</h3>
                <p className="text-xs text-muted-foreground">
                  The <code className="bg-muted px-1 rounded">llms.txt</code> file helps AI assistants find your context files.
                </p>
              </div>

              <div className="flex items-center gap-3 p-4 border rounded-lg bg-background">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">llms.txt</p>
                  <p className="text-xs text-muted-foreground">
                    {checkingLlms ? "Checking..." : "File not found"}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleCreateLlmsTxt}
                  disabled={creatingLlms || checkingLlms}
                >
                  {creatingLlms || checkingLlms ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : "Create"}
                </Button>
              </div>

              <Button variant="ghost" size="sm" onClick={handleSkipAndFinish}>
                Skip for now
              </Button>
            </div>
          )}

          {/* Error */}
          {displayError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm">{displayError}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
