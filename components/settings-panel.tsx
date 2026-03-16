"use client"

import { useState, useEffect, useRef } from "react"
import { 
  Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Github, LogOut, 
  ExternalLink, ChevronDown, Search, Lock, FolderOpen, FileText,
  ChevronRight, Check
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

type SetupStep = 1 | 2 | 3 | 4

const STEPS = [
  { num: 1, title: "Authentication", desc: "Connect your GitHub account" },
  { num: 2, title: "Repository", desc: "Select a repository to manage" },
  { num: 3, title: "Context Folder", desc: "Ensure /context/ directory exists" },
  { num: 4, title: "Discovery File", desc: "Create llms.txt for AI discovery" },
]

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const {
    token, setToken,
    user, isVerifying, verifyToken, disconnect,
    repo, setRepo, isConnectingRepo, connectRepo, repoConnected,
    error, clearError,
  } = useGitHub()

  // Determine current step based on state
  const getCurrentStep = (): SetupStep => {
    if (!user) return 1
    if (!repoConnected) return 2
    if (!contextFolderReady) return 3
    if (!llmsTxtReady) return 4
    return 4
  }

  const [showToken, setShowToken] = useState(false)
  const [tokenInput, setTokenInput] = useState(token)
  const [localError, setLocalError] = useState<string | null>(null)

  // Repo picker state
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [reposError, setReposError] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedRepo, setSelectedRepo] = useState(repo)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Step 3 & 4 state
  const [contextFolderReady, setContextFolderReady] = useState(false)
  const [llmsTxtReady, setLlmsTxtReady] = useState(false)
  const [checkingContext, setCheckingContext] = useState(false)
  const [checkingLlms, setCheckingLlms] = useState(false)
  const [creatingContext, setCreatingContext] = useState(false)
  const [creatingLlms, setCreatingLlms] = useState(false)

  const currentStep = getCurrentStep()

  // Load repos whenever the user is authenticated
  useEffect(() => {
    if (!user || !token) { setRepos([]); return }
    setReposLoading(true)
    setReposError(null)
    fetchUserRepos(token)
      .then((r) => { setRepos(r); setReposLoading(false) })
      .catch((e) => { setReposError(e.message); setReposLoading(false) })
  }, [user, token])

  // Check context folder and llms.txt when repo is connected
  useEffect(() => {
    if (!repoConnected || !token || !repo) {
      setContextFolderReady(false)
      setLlmsTxtReady(false)
      return
    }

    const checkSetup = async () => {
      setCheckingContext(true)
      const contextExists = await checkContextFolderExists(token, repo)
      setContextFolderReady(contextExists)
      setCheckingContext(false)

      if (contextExists) {
        setCheckingLlms(true)
        const llmsExists = await checkLlmsTxtExists(token, repo)
        setLlmsTxtReady(llmsExists)
        setCheckingLlms(false)
      }
    }

    checkSetup()
  }, [repoConnected, token, repo])

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

  const handleVerify = async () => {
    clearError()
    setLocalError(null)
    const ok = await verifyToken(tokenInput)
    if (!ok) setLocalError(error)
  }

  const handleConnect = async () => {
    clearError()
    setLocalError(null)
    const ok = await connectRepo(selectedRepo)
    if (!ok) setLocalError(error)
  }

  const handleCreateContextFolder = async () => {
    if (!token || !repo) return
    setCreatingContext(true)
    setLocalError(null)
    try {
      await createContextFolder(token, repo)
      setContextFolderReady(true)
      // Now check llms.txt
      setCheckingLlms(true)
      const llmsExists = await checkLlmsTxtExists(token, repo)
      setLlmsTxtReady(llmsExists)
      setCheckingLlms(false)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Failed to create context folder")
    } finally {
      setCreatingContext(false)
    }
  }

  const handleCreateLlmsTxt = async () => {
    if (!token || !repo) return
    setCreatingLlms(true)
    setLocalError(null)
    try {
      await createLlmsTxt(token, repo)
      setLlmsTxtReady(true)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Failed to create llms.txt")
    } finally {
      setCreatingLlms(false)
    }
  }

  const handleDisconnect = () => {
    disconnect()
    setTokenInput("")
    setSelectedRepo("")
    setRepos([])
    setLocalError(null)
    setContextFolderReady(false)
    setLlmsTxtReady(false)
    onClose()
  }

  const displayError = localError || error
  const isFullySetup = user && repoConnected && contextFolderReady && llmsTxtReady

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5 text-foreground" />
            <DialogTitle className="font-serif">Repository Setup</DialogTitle>
          </div>
          <DialogDescription>
            Connect your repository and configure it for AI context management.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-2 py-3 border-b">
          {STEPS.map((step, idx) => {
            const isComplete = 
              (step.num === 1 && !!user) ||
              (step.num === 2 && repoConnected) ||
              (step.num === 3 && contextFolderReady) ||
              (step.num === 4 && llmsTxtReady)
            const isCurrent = currentStep === step.num && !isFullySetup
            
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
          {/* Step 1: Auth */}
          {currentStep === 1 && !user && (
            <div className="flex flex-col gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="text-sm font-medium mb-1">Step 1: Authentication</h3>
                <p className="text-xs text-muted-foreground">
                  Enter a GitHub Personal Access Token with <code className="bg-muted px-1 rounded">repo</code> scope. 
                  This allows the app to read and write files in your repositories.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Label className="text-sm font-medium">Personal Access Token</Label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={tokenInput}
                    onChange={(e) => { setTokenInput(e.target.value); clearError() }}
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleVerify}
                    disabled={!tokenInput.trim() || isVerifying}
                    className="flex-1"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : "Verify & Continue"}
                  </Button>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Generate token
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Repo Selection */}
          {currentStep === 2 && user && !repoConnected && (
            <div className="flex flex-col gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Connected as @{user.login}</span>
                </div>
                <h3 className="text-sm font-medium mb-1">Step 2: Select Repository</h3>
                <p className="text-xs text-muted-foreground">
                  Choose the repository where your context files will be stored. 
                  This is typically the main project repository you want AI assistants to understand.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Label className="text-sm font-medium">Repository</Label>
                
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
                  onClick={handleConnect}
                  disabled={!selectedRepo.trim() || isConnectingRepo}
                >
                  {isConnectingRepo ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : "Connect & Continue"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Context Folder */}
          {currentStep === 3 && repoConnected && !contextFolderReady && (
            <div className="flex flex-col gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Repository: {repo}</span>
                </div>
                <h3 className="text-sm font-medium mb-1">Step 3: Context Directory</h3>
                <p className="text-xs text-muted-foreground">
                  Context files need a dedicated <code className="bg-muted px-1 rounded">/context/</code> folder. 
                  This keeps your AI context documents organized and separate from source code.
                </p>
              </div>

              <div className="flex items-center gap-3 p-4 border rounded-lg bg-background">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">/context/</p>
                  <p className="text-xs text-muted-foreground">
                    {checkingContext ? "Checking if folder exists..." : "Folder not found in repository"}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleCreateContextFolder}
                  disabled={creatingContext || checkingContext}
                >
                  {creatingContext ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : checkingContext ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Checking...
                    </>
                  ) : "Create Folder"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: llms.txt */}
          {currentStep === 4 && contextFolderReady && !llmsTxtReady && (
            <div className="flex flex-col gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">/context/ folder ready</span>
                </div>
                <h3 className="text-sm font-medium mb-1">Step 4: Discovery File</h3>
                <p className="text-xs text-muted-foreground">
                  The <code className="bg-muted px-1 rounded">llms.txt</code> file helps AI assistants discover your context files. 
                  It sits in the repository root and points to the /context/ folder.
                </p>
              </div>

              <div className="flex items-center gap-3 p-4 border rounded-lg bg-background">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">llms.txt</p>
                  <p className="text-xs text-muted-foreground">
                    {checkingLlms ? "Checking if file exists..." : "File not found in repository"}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleCreateLlmsTxt}
                  disabled={creatingLlms || checkingLlms}
                >
                  {creatingLlms ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : checkingLlms ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Checking...
                    </>
                  ) : "Create File"}
                </Button>
              </div>
            </div>
          )}

          {/* Setup Complete */}
          {isFullySetup && (
            <div className="flex flex-col gap-4">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="text-sm font-medium mb-1">Setup Complete</h3>
                <p className="text-xs text-muted-foreground">
                  Your repository is configured for AI context management.
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Connected as @{user?.login}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="font-mono">{repo}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>/context/ folder ready</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>llms.txt discovery file created</span>
                </div>
              </div>

              <Button onClick={onClose} className="w-full">
                Start Managing Context
              </Button>
            </div>
          )}

          {/* Error */}
          {displayError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{displayError}</span>
            </div>
          )}

          {/* Disconnect */}
          {user && (
            <div className="border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full"
              >
                <LogOut className="h-3.5 w-3.5" />
                Disconnect Account
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
