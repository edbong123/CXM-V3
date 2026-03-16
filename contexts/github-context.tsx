"use client"
// GitHub Context Provider - manages auth, projects, and file operations

import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import type { ContextFile } from "@/lib/github-client"
import { 
  fetchContextFiles, 
  fetchFileContent, 
  fetchFileSha, 
  commitFile, 
  checkLlmsTxtExists, 
  createLlmsTxt, 
  checkContextFolderExists, 
  createContextFolder 
} from "@/lib/github-client"

interface GitHubUser {
  login: string
  avatar_url: string
  name: string | null
}

// Project represents a connected repository
export interface Project {
  id: string
  repo: string // owner/repo format
  contextFolderReady: boolean
  llmsTxtReady: boolean
  createdAt: number
}

interface GitHubContextType {
  // Auth (shared across all projects)
  token: string
  setToken: (token: string) => void
  user: GitHubUser | null
  isVerifying: boolean
  verifyToken: (tokenToVerify?: string) => Promise<boolean>
  disconnect: () => void

  // Projects
  projects: Project[]
  activeProject: Project | null
  setActiveProject: (project: Project | null) => void
  addProject: (repo: string) => Promise<Project | null>
  removeProject: (projectId: string) => void
  updateProject: (projectId: string, updates: Partial<Project>) => void

  // Current project files
  files: ContextFile[]
  llmsFile: ContextFile | null
  isLoadingFiles: boolean
  fetchFiles: () => Promise<void>
  selectedFile: ContextFile | null
  selectFile: (file: ContextFile) => void
  forceSelectFile: (file: ContextFile) => void
  fileContent: string
  isLoadingContent: boolean

  // Commit (for active project)
  commitChanges: (content: string, message: string) => Promise<boolean>
  isCommitting: boolean

  // Review mode
  isReviewMode: boolean
  setIsReviewMode: (value: boolean) => void
  pendingFileSelect: ContextFile | null
  setPendingFileSelect: (file: ContextFile | null) => void

  // Legacy repo access (for backwards compatibility)
  repo: string
  repoConnected: boolean

  // Error
  error: string | null
  clearError: () => void
}

const GitHubContext = createContext<GitHubContextType | null>(null)

export function GitHubProvider({ children }: { children: React.ReactNode }) {
  // Auth state (shared)
  const [token, setTokenState] = useState("")
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  // Projects state
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)

  // Files state (for active project)
  const [files, setFiles] = useState<ContextFile[]>([])
  const [llmsFile, setLlmsFile] = useState<ContextFile | null>(null)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [selectedFile, setSelectedFile] = useState<ContextFile | null>(null)
  const [fileContent, setFileContent] = useState("")
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isReviewMode, setIsReviewMode] = useState(false)
  const [pendingFileSelect, setPendingFileSelect] = useState<ContextFile | null>(null)

  // Derived state
  const activeProject = projects.find(p => p.id === activeProjectId) || null
  const repo = activeProject?.repo || ""
  const repoConnected = !!activeProject

  // Load persisted state on mount
  useEffect(() => {
    const stored = localStorage.getItem("github_ctx_v2")
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.token) setTokenState(parsed.token)
        if (parsed.user) setUser(parsed.user)
        if (parsed.projects) setProjects(parsed.projects)
        if (parsed.activeProjectId) setActiveProjectId(parsed.activeProjectId)
      } catch {
        // Try legacy format
        const legacy = localStorage.getItem("github_ctx")
        if (legacy) {
          try {
            const legacyParsed = JSON.parse(legacy)
            if (legacyParsed.token) setTokenState(legacyParsed.token)
            if (legacyParsed.user) setUser(legacyParsed.user)
            // Migrate single repo to project
            if (legacyParsed.repo && legacyParsed.repoConnected) {
              const migratedProject: Project = {
                id: `project-${Date.now()}`,
                repo: legacyParsed.repo,
                contextFolderReady: true,
                llmsTxtReady: true,
                createdAt: Date.now()
              }
              setProjects([migratedProject])
              setActiveProjectId(migratedProject.id)
            }
          } catch {}
        }
      }
    }
  }, [])

  const persist = useCallback((updates: Record<string, unknown>) => {
    const stored = localStorage.getItem("github_ctx_v2")
    const current = stored ? JSON.parse(stored) : {}
    localStorage.setItem("github_ctx_v2", JSON.stringify({ ...current, ...updates }))
  }, [])

  const setToken = useCallback((t: string) => {
    setTokenState(t)
    persist({ token: t })
  }, [persist])

  const verifyToken = useCallback(async (tokenToVerify?: string): Promise<boolean> => {
    const tokenValue = tokenToVerify ?? token
    if (!tokenValue.trim()) {
      setError("Please enter a Personal Access Token.")
      return false
    }
    if (tokenToVerify && tokenToVerify !== token) {
      setTokenState(tokenToVerify)
      persist({ token: tokenToVerify })
    }
    setIsVerifying(true)
    setError(null)
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tokenValue}`, Accept: "application/vnd.github+json" },
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
    setProjects([])
    setActiveProjectId(null)
    setFiles([])
    setSelectedFile(null)
    setFileContent("")
    localStorage.removeItem("github_ctx_v2")
    localStorage.removeItem("github_ctx")
  }, [])

  const setActiveProject = useCallback((project: Project | null) => {
    setActiveProjectId(project?.id || null)
    persist({ activeProjectId: project?.id || null })
    // Clear current file state when switching projects
    setFiles([])
    setLlmsFile(null)
    setSelectedFile(null)
    setFileContent("")
    setIsReviewMode(false)
    setPendingFileSelect(null)
  }, [persist])

  const addProject = useCallback(async (repoFullName: string): Promise<Project | null> => {
    if (!token) {
      setError("Please authenticate first.")
      return null
    }

    // Check if project already exists
    if (projects.some(p => p.repo === repoFullName)) {
      setError("This repository is already added as a project.")
      return null
    }

    // Verify repo access
    try {
      const res = await fetch(`https://api.github.com/repos/${repoFullName}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      })
      if (!res.ok) {
        setError("Repository not found or access denied.")
        return null
      }
    } catch {
      setError("Network error. Please try again.")
      return null
    }

    // Check context folder and llms.txt
    const contextExists = await checkContextFolderExists(token, repoFullName)
    const llmsExists = await checkLlmsTxtExists(token, repoFullName)

    const newProject: Project = {
      id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      repo: repoFullName,
      contextFolderReady: contextExists,
      llmsTxtReady: llmsExists,
      createdAt: Date.now()
    }

    const newProjects = [...projects, newProject]
    setProjects(newProjects)
    persist({ projects: newProjects })

    return newProject
  }, [token, projects, persist])

  const removeProject = useCallback((projectId: string) => {
    const newProjects = projects.filter(p => p.id !== projectId)
    setProjects(newProjects)
    persist({ projects: newProjects })

    // If removing active project, switch to first available or null
    if (activeProjectId === projectId) {
      const nextProject = newProjects[0] || null
      setActiveProjectId(nextProject?.id || null)
      persist({ activeProjectId: nextProject?.id || null })
      setFiles([])
      setLlmsFile(null)
      setSelectedFile(null)
      setFileContent("")
    }
  }, [projects, activeProjectId, persist])

  const updateProject = useCallback((projectId: string, updates: Partial<Project>) => {
    const newProjects = projects.map(p => 
      p.id === projectId ? { ...p, ...updates } : p
    )
    setProjects(newProjects)
    persist({ projects: newProjects })
  }, [projects, persist])

  const fetchFiles = useCallback(async () => {
    if (!activeProject || !token) return
    setIsLoadingFiles(true)
    setError(null)
    try {
      const [fetched, llms] = await Promise.all([
        fetchContextFiles(token, activeProject.repo),
        checkLlmsTxtExists(token, activeProject.repo).then(exists => {
          if (exists) {
            return { name: "llms.txt", path: "llms.txt", sha: "" }
          } else {
            return createLlmsTxt(token, activeProject.repo).then(() => ({
              name: "llms.txt",
              path: "llms.txt",
              sha: ""
            }))
          }
        })
      ])
      setFiles(fetched)
      setLlmsFile(llms)

      // Update project status
      if (!activeProject.llmsTxtReady) {
        updateProject(activeProject.id, { llmsTxtReady: true })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch files.")
    } finally {
      setIsLoadingFiles(false)
    }
  }, [activeProject, token, updateProject])

  const selectFile = useCallback(async (file: ContextFile) => {
    if (!activeProject || !token) return
    if (isReviewMode) {
      setPendingFileSelect(file)
      return
    }
    setSelectedFile(file)
    setIsLoadingContent(true)
    setFileContent("")
    try {
      const content = await fetchFileContent(token, activeProject.repo, file.path)
      setFileContent(content)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load file.")
    } finally {
      setIsLoadingContent(false)
    }
  }, [token, activeProject, isReviewMode])

  const forceSelectFile = useCallback(async (file: ContextFile) => {
    if (!activeProject || !token) return
    setPendingFileSelect(null)
    setSelectedFile(file)
    setIsLoadingContent(true)
    setFileContent("")
    try {
      const content = await fetchFileContent(token, activeProject.repo, file.path)
      setFileContent(content)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load file.")
    } finally {
      setIsLoadingContent(false)
    }
  }, [token, activeProject])

  const commitChanges = useCallback(async (content: string, message: string): Promise<boolean> => {
    if (!selectedFile || !activeProject || !token) return false
    setIsCommitting(true)
    setError(null)
    try {
      const latestSha = await fetchFileSha(token, activeProject.repo, selectedFile.path)
      await commitFile(token, activeProject.repo, selectedFile.path, latestSha, content, message)
      const fetched = await fetchContextFiles(token, activeProject.repo)
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
  }, [selectedFile, token, activeProject])

  const clearError = useCallback(() => setError(null), [])

  return (
    <GitHubContext.Provider value={{
      token, setToken, user, isVerifying, verifyToken, disconnect,
      projects, activeProject, setActiveProject, addProject, removeProject, updateProject,
      files, llmsFile, isLoadingFiles, fetchFiles, selectedFile, selectFile, forceSelectFile, fileContent, isLoadingContent,
      commitChanges, isCommitting,
      isReviewMode, setIsReviewMode, pendingFileSelect, setPendingFileSelect,
      repo, repoConnected,
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
