"use client"

import { useState } from "react"
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Github, LogOut, ExternalLink } from "lucide-react"
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
  const [repoInput, setRepoInput] = useState(repo)
  const [localError, setLocalError] = useState<string | null>(null)

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
    setRepo(repoInput)
    const ok = await connectRepo()
    if (!ok) setLocalError(error)
  }

  const handleDisconnect = () => {
    disconnect()
    setTokenInput("")
    setRepoInput("")
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

              <Input
                placeholder="owner/repository"
                value={repoInput}
                onChange={(e) => { setRepoInput(e.target.value); clearError() }}
                className="font-mono text-sm"
              />

              <Button
                size="sm"
                onClick={handleConnect}
                disabled={!repoInput.trim() || isConnectingRepo}
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
