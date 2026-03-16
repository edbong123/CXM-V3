"use client"

import { useState, useEffect, useRef } from "react"
import { 
  Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Github, LogOut, 
  ExternalLink, ChevronDown, Search, Lock, FolderOpen, FileText,
  ChevronRight, Check, User
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
import { cn } from "@/lib/utils"

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const {
    token, 
    user, isVerifying, verifyToken, disconnect,
    error, clearError,
  } = useGitHub()

  const [showToken, setShowToken] = useState(false)
  const [tokenInput, setTokenInput] = useState(token || "")
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTokenInput(token || "")
      setLocalError(null)
    }
  }, [open, token])

  const handleVerify = async () => {
    clearError()
    setLocalError(null)
    const ok = await verifyToken(tokenInput)
    if (!ok) setLocalError(error)
  }

  const handleDisconnect = () => {
    disconnect()
    setTokenInput("")
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
            <DialogTitle className="font-serif">GitHub Settings</DialogTitle>
          </div>
          <DialogDescription>
            Manage your GitHub authentication. Projects are configured separately.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          {/* Not authenticated */}
          {!user && (
            <div className="flex flex-col gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="text-sm font-medium mb-1">Authentication</h3>
                <p className="text-xs text-muted-foreground">
                  Enter a GitHub Personal Access Token with <code className="bg-muted px-1 rounded">repo</code> scope. 
                  This token is shared across all projects.
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
                    ) : "Connect GitHub"}
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

          {/* Authenticated */}
          {user && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
                {user.avatar_url ? (
                  <img 
                    src={user.avatar_url} 
                    alt={user.login} 
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name || user.login}</p>
                  <p className="text-xs text-muted-foreground truncate">@{user.login}</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Token</Label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
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
                {tokenInput !== token && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleVerify}
                    disabled={isVerifying}
                  >
                    {isVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Update Token"}
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={handleDisconnect}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors underline-offset-2 hover:underline"
                >
                  Disconnect account
                </button>
                <Button onClick={onClose}>
                  Continue
                </Button>
              </div>
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
