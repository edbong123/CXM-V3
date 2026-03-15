"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import type { ContextFile } from "@/lib/github-client"
import { fetchContextFiles, fetchFileContent, fetchFileSha, commitFile } from "@/lib/github-client"

interface GitHubUser {
  login: string
  avatar_url: string
  name: string | null
}

interface GitHubContextType {
  // Auth
  token: string
  setToken: (token: string) => void
  user: GitHubUser | null
  isVerifying: boolean
  verifyToken: () => Promise<boolean>
  disconnect: () => void

  // Repo
  repo: string
  setRepo: (repo: string) => void
  isConnectingRepo: boolean
  connectRepo: () => Promise<boolean>
  repoConnected: boolean

  // Files
  files: ContextFile[]
  isLoadingFiles: boolean
  fetchFiles: () => Promise<void>
  selectedFile: ContextFile | null
  selectFile: (file: ContextFile) => void
  forceSelectFile: (file: ContextFile) => void
  fileContent: string
  isLoadingContent: boolean

  // Commit
  commitChanges: (content: string, message: string) => Promise<boolean>
  isCommitting: boolean

  // Review mode (shared state for pending changes from suggestions)
  isReviewMode: boolean
  setIsReviewMode: (value: boolean) => void
  pendingFileSelect: ContextFile | null
  setPendingFileSelect: (file: ContextFile | null) => void

  // Error
  error: string | null
  clearError: () => void
}

const GitHubContext = createContext<GitHubContextType | null>(null)

export function GitHubProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState("")
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [repo, setRepoState] = useState("")
  const [repoConnected, setRepoConnected] = useState(false)
  const [isConnectingRepo, setIsConnectingRepo] = useState(false)
  const [files, setFiles] = useState<ContextFile[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [selectedFile, setSelectedFile] = useState<ContextFile | null>(null)
  const [fileContent, setFileContent] = useState("")
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isReviewMode, setIsReviewMode] = useState(false)
  const [pendingFileSelect, setPendingFileSelect] = useState<ContextFile | null>(null)

  // Load persisted state on mount
  useEffect(() => {
    const stored = localStorage.getItem("github_ctx")
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.token) setTokenState(parsed.token)
        if (parsed.user) setUser(parsed.user)
        if (parsed.repo) setRepoState(parsed.repo)
        if (parsed.repoConnected) setRepoConnected(parsed.repoConnected)
      } catch {
        // ignore
      }
    }
  }, [])

  const persist = useCallback((updates: Record<string, unknown>) => {
    const stored = localStorage.getItem("github_ctx")
    const current = stored ? JSON.parse(stored) : {}
    localStorage.setItem("github_ctx", JSON.stringify({ ...current, ...updates }))
  }, [])

  const setToken = useCallback((t: string) => {
    setTokenState(t)
    persist({ token: t })
  }, [persist])

  const setRepo = useCallback((r: string) => {
    setRepoState(r)
    setRepoConnected(false)
    persist({ repo: r, repoConnected: false })
  }, [persist])

  const verifyToken = useCallback(async (): Promise<boolean> => {
    if (!token.trim()) {
      setError("Please enter a Personal Access Token.")
      return false
    }
    setIsVerifying(true)
    setError(null)
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      })
      if (!res.ok) {
        setError("Invalid token. Please check and try again.")
        return false
      }
      const data = await res.json()
      const u: GitHubUser = { login: data.login, avatar_url: data.avatar_url, name: data.name }
      setUser(u)
      persist({ user: u })
      return true
    } catch {
      setError("Network error. Please try again.")
      return false
    } finally {
      setIsVerifying(false)
    }
  }, [token, persist])

  const disconnect = useCallback(() => {
    setTokenState("")
    setUser(null)
    setRepoState("")
    setRepoConnected(false)
    setFiles([])
    setSelectedFile(null)
    setFileContent("")
    localStorage.removeItem("github_ctx")
  }, [])

  const connectRepo = useCallback(async (): Promise<boolean> => {
    if (!repo.trim() || !repo.includes("/")) {
      setError("Please enter a valid repo in owner/repo format.")
      return false
    }
    setIsConnectingRepo(true)
    setError(null)
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      })
      if (!res.ok) {
        setError("Repository not found or access denied.")
        return false
      }
      setRepoConnected(true)
      persist({ repo, repoConnected: true })
      return true
    } catch {
      setError("Network error. Please try again.")
      return false
    } finally {
      setIsConnectingRepo(false)
    }
  }, [repo, token, persist])

  const fetchFiles = useCallback(async () => {
    if (!repo || !token) return
    setIsLoadingFiles(true)
    setError(null)
    try {
      const fetched = await fetchContextFiles(token, repo)
      setFiles(fetched)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch files.")
    } finally {
      setIsLoadingFiles(false)
    }
  }, [repo, token])

  const selectFile = useCallback(async (file: ContextFile) => {
    // If in review mode, store pending and let FileViewer show dialog
    if (isReviewMode) {
      setPendingFileSelect(file)
      return
    }
    setSelectedFile(file)
    setIsLoadingContent(true)
    setFileContent("")
    try {
      const content = await fetchFileContent(token, repo, file.path)
      setFileContent(content)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load file.")
    } finally {
      setIsLoadingContent(false)
    }
  }, [token, repo, isReviewMode])

  // Force select bypasses review mode check (used after user confirms discard)
  const forceSelectFile = useCallback(async (file: ContextFile) => {
    setPendingFileSelect(null)
    setSelectedFile(file)
    setIsLoadingContent(true)
    setFileContent("")
    try {
      const content = await fetchFileContent(token, repo, file.path)
      setFileContent(content)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load file.")
    } finally {
      setIsLoadingContent(false)
    }
  }, [token, repo])

  const commitChanges = useCallback(async (content: string, message: string): Promise<boolean> => {
    if (!selectedFile) return false
    setIsCommitting(true)
    setError(null)
    try {
      // Fetch the latest SHA to avoid conflicts with concurrent changes
      const latestSha = await fetchFileSha(token, repo, selectedFile.path)
      await commitFile(token, repo, selectedFile.path, latestSha, content, message)
      // Update sha by re-fetching
      const fetched = await fetchContextFiles(token, repo)
      setFiles(fetched)
      const updated = fetched.find(f => f.path === selectedFile.path)
      if (updated) {
        setSelectedFile(updated)
        setFileContent(content)
      }
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to commit.")
      return false
    } finally {
      setIsCommitting(false)
    }
  }, [selectedFile, token, repo])

  const clearError = useCallback(() => setError(null), [])

  return (
    <GitHubContext.Provider value={{
      token, setToken, user, isVerifying, verifyToken, disconnect,
      repo, setRepo, isConnectingRepo, connectRepo, repoConnected,
      files, isLoadingFiles, fetchFiles, selectedFile, selectFile, forceSelectFile, fileContent, isLoadingContent,
      commitChanges, isCommitting,
      isReviewMode, setIsReviewMode, pendingFileSelect, setPendingFileSelect,
      error, clearError,
    }}>
      {children}
    </GitHubContext.Provider>
  )
}

export function useGitHub() {
  const ctx = useContext(GitHubContext)
  if (!ctx) throw new Error("useGitHub must be used within GitHubProvider")
  return ctx
}
