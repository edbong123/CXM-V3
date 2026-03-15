"use client"

import { useState, useEffect } from "react"
import { Settings, Github, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Toaster } from "sonner"
import { GitHubProvider, useGitHub } from "@/contexts/github-context"
import { SettingsPanel } from "@/components/settings-panel"
import { ContextFilesList } from "@/components/context-files-list"
import { FileViewer } from "@/components/file-viewer"

export default function Page() {
  return (
    <GitHubProvider>
      <AppShell />
      <Toaster richColors position="bottom-right" />
    </GitHubProvider>
  )
}

function AppShell() {
  const { user, repoConnected, fetchFiles, error, clearError } = useGitHub()
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Auto-fetch files when fully connected
  useEffect(() => {
    if (user && repoConnected) {
      fetchFiles()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, repoConnected])

  const isConnected = !!user && repoConnected

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b px-4 h-12 shrink-0 bg-background z-10">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Restacked" className="h-6 w-6" />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight">restacked.ai</span>
            <span className="text-xs text-muted-foreground">CXM</span>
          </div>
          {isConnected && (
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-muted-foreground border rounded-full px-2.5 py-0.5 ml-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              Connected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <span className="hidden sm:block text-xs text-muted-foreground">
              @{user.login}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>
      </header>

      {/* Global error banner */}
      {error && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={clearError} className="text-xs underline underline-offset-2 hover:no-underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* Main content */}
      {!isConnected ? (
        <NotConnectedState onOpenSettings={() => setSettingsOpen(true)} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <ContextFilesList />
          <main className="flex-1 overflow-hidden">
            <FileViewer />
          </main>
        </div>
      )}

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

function NotConnectedState({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-5 text-center max-w-sm px-6">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Github className="h-8 w-8 text-muted-foreground/60" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">Connect your repository</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Add your GitHub Personal Access Token and connect a repository to start managing context files with AI-powered suggestions.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Button onClick={onOpenSettings} className="w-full">
            <Settings className="h-4 w-4" />
            Open Settings
          </Button>
          <p className="text-xs text-muted-foreground">
            Requires a PAT with{" "}
            <code className="bg-muted px-1 rounded text-xs">repo</code> scope.
          </p>
        </div>

        {/* Demo hint */}
        <div className="border rounded-lg p-4 text-left bg-muted/30 w-full">
          <p className="text-xs font-medium mb-2">Demo mode</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Mock suggestions are pre-loaded for files named{" "}
            <code className="bg-muted px-1 rounded">BUSINESS-CONTEXT.md</code>,{" "}
            <code className="bg-muted px-1 rounded">TECH-STACK.md</code>, and{" "}
            <code className="bg-muted px-1 rounded">README.md</code> in your{" "}
            <code className="bg-muted px-1 rounded">context/</code> folder.
          </p>
        </div>
      </div>
    </div>
  )
}
