"use client"

import { useState, useEffect, useRef } from "react"
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Github, LogOut, ExternalLink, ChevronDown, Search, Lock } from "lucide-react"
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
import { fetchUserRepos, type GitHubRepo } from "@/lib/github-client"
import { cn } from "@/lib/utils"

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const {
    token, setToken,
    user, isVerifying, verifyToken, disconnect,
    repo, setRepo, isConnectingRepo, connectRepo, repoConnected,
    error, clearError,
  } = useGitHub()

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

  // Load repos whenever the user is authenticated
  useEffect(() => {
    if (!user || !token) { setRepos([]); return }
    setReposLoading(true)
    setReposError(null)
    fetchUserRepos(token)
      .then((r) => { setRepos(r); setReposLoading(false) })
      .catch((e) => { setReposError(e.message); setReposLoading(false) })
  }, [user, token])

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
    setToken(tokenInput)
    const ok = await verifyToken()
    if (!ok) setLocalError(error)
  }

  const handleConnect = async () => {
    clearError()
    setLocalError(null)
    setRepo(selectedRepo)
    const ok = await connectRepo()
    if (!ok) setLocalError(error)
  }

  const handleDisconnect = () => {
    disconnect()
    setTokenInput("")
    setSelectedRepo("")
    setRepos([])
    setLocalError(null)
    onClose()
  }

  const displayError = localError || error

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5 text-foreground" />
            <DialogTitle>GitHub Settings</DialogTitle>
          </div>
          <DialogDescription>
            Connect your GitHub account and repository to manage context files.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 pt-1">
          {/* Auth Section */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Personal Access Token</Label>
              {user && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Connected as @{user.login}</span>
                </div>
              )}
            </div>

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
                aria-label={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleVerify}
                disabled={!tokenInput.trim() || isVerifying}
                className="flex-1"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Verifying...
                  </>
                ) : user ? "Re-verify Token" : "Verify Token"}
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

          {/* Repo Section */}
          {user && (
            <div className="flex flex-col gap-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Repository</Label>
                {repoConnected && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Connected</span>
                  </div>
                )}
              </div>

              {/* Searchable repo picker */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => { setDropdownOpen((o) => !o); setSearch("") }}
                  disabled={reposLoading}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm transition-colors",
                    "hover:border-ring focus:outline-none focus:ring-2 focus:ring-ring",
                    !selectedRepo && "text-muted-foreground"
                  )}
                >
                  <span className={cn("truncate font-mono", selectedRepo ? "text-foreground" : "text-muted-foreground")}>
                    {reposLoading
                      ? "Loading repositories..."
                      : selectedRepo || "Select a repository"}
                  </span>
                  {reposLoading
                    ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                    : <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", dropdownOpen && "rotate-180")} />
                  }
                </button>

                {dropdownOpen && !reposLoading && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                    {/* Search box */}
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

                    {/* Repo list */}
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
                          {r.private && (
                            <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Button
                size="sm"
                onClick={handleConnect}
                disabled={!selectedRepo.trim() || isConnectingRepo}
              >
                {isConnectingRepo ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Connecting...
                  </>
                ) : repoConnected ? "Reconnect Repository" : "Connect Repository"}
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

          {/* Status summary */}
          {user && repoConnected && (
            <div className={cn(
              "rounded-md border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground"
            )}>
              Ready to manage context files in{" "}
              <span className="font-mono font-medium text-foreground">{repo}/context/</span>
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
