"use client"

import { useState, useEffect } from "react"
import { Settings, Github, AlertCircle, Copy, Check, ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Toaster } from "sonner"
import { GitHubProvider, useGitHub } from "@/contexts/github-context"
import { SuggestionsProvider } from "@/contexts/suggestions-context"
import { SettingsPanel } from "@/components/settings-panel"
import { AddProjectDialog } from "@/components/add-project-dialog"
import { ProjectSettingsDialog } from "@/components/project-settings-dialog"
import { ContextFilesList } from "@/components/context-files-list"
import { FileViewer } from "@/components/file-viewer"
import { ChatView } from "@/components/chat-view"
import { cn } from "@/lib/utils"

export default function Page() {
  return (
    <GitHubProvider>
      <SuggestionsProvider>
        <AppShell />
        <Toaster richColors position="bottom-right" />
      </SuggestionsProvider>
    </GitHubProvider>
  )
}

function AppShell() {
  const { user, repo, repoConnected, activeProject, fetchFiles, error, clearError } = useGitHub()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addProjectOpen, setAddProjectOpen] = useState(false)
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false)
  const [projectSettingsId, setProjectSettingsId] = useState<string | null>(null)

  const handleOpenProjectSettings = (projectId: string) => {
    setProjectSettingsId(projectId)
    setProjectSettingsOpen(true)
  }
  const [copiedIn, setCopiedIn] = useState(false)
  const [copiedOut, setCopiedOut] = useState(false)

  // MCP URLs - mcpInUrl points to the proper MCP server (mcp-handler catch-all)
  const mcpInUrl = activeProject ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/mcp` : null
  const mcpOutUrl = repo ? `https://gitmcp.io/${repo}` : null

  const handleCopyMcpIn = () => {
    if (!mcpInUrl) return
    navigator.clipboard.writeText(mcpInUrl)
    setCopiedIn(true)
    setTimeout(() => setCopiedIn(false), 2000)
  }

  const handleCopyMcpOut = () => {
    if (!mcpOutUrl) return
    navigator.clipboard.writeText(mcpOutUrl)
    setCopiedOut(true)
    setTimeout(() => setCopiedOut(false), 2000)
  }
  const [chatMode, setChatMode] = useState(false)
  const [chatInitialFile, setChatInitialFile] = useState<string | null>(null)
  const [chatInitialMode, setChatInitialMode] = useState<"suggest" | "ask-questions" | null>(null)
  const [chatKey, setChatKey] = useState(0)
  const [pendingTab, setPendingTab] = useState<"suggestions" | null>(null)

  const handleOpenChat = (fileName?: string, mode?: "suggest" | "ask-questions") => {
    setChatInitialFile(fileName || null)
    setChatInitialMode(mode || null)
    setChatKey(k => k + 1)
    setChatMode(true)
  }

  const handleNavigateToSuggestions = () => {
    setPendingTab("suggestions")
    setChatMode(false)
  }

  // Auto-fetch files when project is active
  useEffect(() => {
    if (user && activeProject) {
      fetchFiles()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeProject?.id])

  const isConnected = !!user && !!activeProject

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b px-4 h-12 shrink-0 bg-background z-10">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Restacked" className="h-7 w-7" />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-serif font-semibold tracking-tight">restacked.ai</span>
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Context Manager</span>
          </div>
        </div>

        {/* MCP Icons */}
        {activeProject && (
          <div className="flex items-center gap-1">
            {/* MCP In - receive suggestions */}
            <button
              onClick={handleCopyMcpIn}
              title="Copy MCP Inbound URL (receive suggestions)"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors border",
                copiedIn
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                  : "bg-muted/40 border-transparent hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">MCP In</span>
              {copiedIn && <Check className="h-3 w-3" />}
            </button>
            
            {/* MCP Out - GitMCP for context */}
            {mcpOutUrl && (
              <button
                onClick={handleCopyMcpOut}
                title="Copy GitMCP URL (share context)"
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors border",
                  copiedOut
                    ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                    : "bg-muted/40 border-transparent hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                )}
              >
                <ArrowUpFromLine className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">MCP Out</span>
                {copiedOut && <Check className="h-3 w-3" />}
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {user && (
            <div className="hidden sm:flex items-center gap-1.5">
              {isConnected && (
                <span
                  title="Connected to GitHub"
                  className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 cursor-default"
                />
              )}
              <span className="text-xs text-muted-foreground">@{user.login}</span>
            </div>
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
      {!user ? (
        <NotConnectedState onOpenSettings={() => setSettingsOpen(true)} type="auth" />
      ) : !activeProject ? (
        <NotConnectedState onOpenSettings={() => setAddProjectOpen(true)} type="project" />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <ContextFilesList 
            onNewChat={() => handleOpenChat()} 
            onFileSelect={() => setChatMode(false)} 
            onOpenSettings={() => setSettingsOpen(true)}
            onAddProject={() => setAddProjectOpen(true)}
            onOpenProjectSettings={handleOpenProjectSettings}
          />
          <main className="flex-1 overflow-hidden">
            {chatMode ? (
              <ChatView key={chatKey} onClose={() => setChatMode(false)} initialFile={chatInitialFile} initialMode={chatInitialMode} onNavigateToSuggestions={handleNavigateToSuggestions} />
            ) : (
              <FileViewer onOpenChat={handleOpenChat} pendingTab={pendingTab} onPendingTabHandled={() => setPendingTab(null)} />
            )}
          </main>
        </div>
      )}

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AddProjectDialog open={addProjectOpen} onClose={() => setAddProjectOpen(false)} />
      <ProjectSettingsDialog 
        open={projectSettingsOpen} 
        onClose={() => { setProjectSettingsOpen(false); setProjectSettingsId(null) }} 
        projectId={projectSettingsId} 
      />
    </div>
  )
}

function NotConnectedState({ onOpenSettings, type }: { onOpenSettings: () => void; type: "auth" | "project" }) {
  const isAuth = type === "auth"
  
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-5 text-center max-w-sm px-6">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Github className="h-8 w-8 text-muted-foreground/60" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-serif font-semibold">
            {isAuth ? "Connect to GitHub" : "Add a Project"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isAuth 
              ? "Add your GitHub Personal Access Token to get started. One token works across all your projects."
              : "Select a repository to add as a project. Each project has its own context files for AI assistants."
            }
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Button onClick={onOpenSettings} className="w-full">
            <Settings className="h-4 w-4" />
            {isAuth ? "Connect GitHub" : "Add Project"}
          </Button>
          {isAuth && (
            <p className="text-xs text-muted-foreground">
              Requires a PAT with{" "}
              <code className="bg-muted px-1 rounded text-xs">repo</code> scope.
            </p>
          )}
        </div>

        {/* Demo hint */}
        <div className="border rounded-lg p-4 text-left bg-muted/30 w-full">
          <p className="text-xs font-medium mb-2">
            {isAuth ? "Getting started" : "Multi-project support"}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isAuth 
              ? "Generate a token at GitHub Settings → Developer Settings → Personal Access Tokens. Enable the 'repo' scope for full access."
              : "You can add multiple repositories as separate projects. Switch between them using the project selector in the sidebar."
            }
          </p>
        </div>
      </div>
    </div>
  )
}
