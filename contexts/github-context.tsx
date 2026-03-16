// GitHub Context Provider
// Cache bust: 2026-03-16T12:00:00Z
"use client"

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

const STORAGE_KEY = "github_token"
const USER_STORAGE_KEY = "github_user"

interface GitHubUser {
  login: string
  avatar_url: string
  name: string
}

interface Project {
  id: string
  repo: string
  createdAt: string
}

interface ContextFile {
  name: string
  path: string
  size: number
  type: string
}

interface GitHubContextType {
  isConnected: boolean
  user: GitHubUser | null
  token: string | null
  projects: Project[]
  activeProjectId: string | null
  activeProject: Project | null
  repo: string | null
  contextFiles: ContextFile[]
  isLoading: boolean
  error: string | null
  isVerifying: boolean
  selectedFile: ContextFile | null
  selectedFileContent: string | null
  isLoadingContent: boolean
  connect: (token: string) => Promise<boolean>
  verifyToken: (token: string) => Promise<boolean>
  clearError: () => void
  disconnect: () => void
  setActiveProject: (projectId: string) => void
  addProject: (repo: string) => void
  removeProject: (projectId: string) => void
  updateProject: (projectId: string, updates: Partial<Project>) => void
  refreshFiles: () => Promise<void>
  selectFile: (file: ContextFile | null) => void
  saveFile: (path: string, content: string, message?: string) => Promise<boolean>
  checkAndCreateContextFolder: (projectId: string) => Promise<boolean>
  checkAndCreateLlmsTxt: (projectId: string) => Promise<boolean>
  repoConnected: boolean
}

const GitHubContext = createContext<GitHubContextType | undefined>(undefined)

export function GitHubProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [selectedFile, setSelectedFile] = useState<ContextFile | null>(null)
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)

  // Initialize from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEY)
    const storedUser = localStorage.getItem(USER_STORAGE_KEY)
    const storedProjects = localStorage.getItem("projects")

    if (storedToken && storedUser) {
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
      setIsConnected(true)
    }

    if (storedProjects) {
      setProjects(JSON.parse(storedProjects))
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const connect = async (newToken: string): Promise<boolean> => {
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${newToken}`,
          Accept: "application/vnd.github.v3+json"
        }
      })

      if (!response.ok) {
        throw new Error("Invalid token")
      }

      const userData = await response.json()
      const githubUser: GitHubUser = {
        login: userData.login,
        avatar_url: userData.avatar_url,
        name: userData.name
      }

      setToken(newToken)
      setUser(githubUser)
      setIsConnected(true)

      localStorage.setItem(STORAGE_KEY, newToken)
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(githubUser))

      return true
    } catch {
      setError("Failed to connect to GitHub")
      return false
    }
  }

  const verifyToken = async (newToken: string): Promise<boolean> => {
    setIsVerifying(true)
    setError(null)
    try {
      const result = await connect(newToken)
      return result
    } finally {
      setIsVerifying(false)
    }
  }

  const disconnect = () => {
    setIsConnected(false)
    setUser(null)
    setToken(null)
    setProjects([])
    setActiveProjectId(null)
    setContextFiles([])
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
  }

  const setActiveProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId)
  }, [])

  const addProject = useCallback((repo: string) => {
    const newProject: Project = {
      id: `proj_${Date.now()}`,
      repo,
      createdAt: new Date().toISOString()
    }
    const updated = [...projects, newProject]
    setProjects(updated)
    localStorage.setItem("projects", JSON.stringify(updated))
    setActiveProjectId(newProject.id)
  }, [projects])

  const removeProject = useCallback((projectId: string) => {
    const updated = projects.filter(p => p.id !== projectId)
    setProjects(updated)
    localStorage.setItem("projects", JSON.stringify(updated))
    if (activeProjectId === projectId) {
      setActiveProjectId(updated[0]?.id || null)
    }
  }, [projects, activeProjectId])

  const updateProject = useCallback((projectId: string, updates: Partial<Project>) => {
    const updated = projects.map(p => p.id === projectId ? { ...p, ...updates } : p)
    setProjects(updated)
    localStorage.setItem("projects", JSON.stringify(updated))
  }, [projects])

  const activeProject = projects.find(p => p.id === activeProjectId) || null
  const repo = activeProject?.repo || null

  const refreshFiles = async () => {
    if (!token || !repo) return
    setIsLoading(true)
    try {
      const files = await fetchContextFiles(repo, token)
      setContextFiles(files || [])
    } catch (err) {
      setError("Failed to fetch context files")
    } finally {
      setIsLoading(false)
    }
  }

  const selectFile = useCallback(async (file: ContextFile | null) => {
    setSelectedFile(file)
    if (!file || !token || !repo) return

    setIsLoadingContent(true)
    try {
      const content = await fetchFileContent(repo, file.path, token)
      setSelectedFileContent(content)
    } catch (err) {
      setError("Failed to fetch file content")
    } finally {
      setIsLoadingContent(false)
    }
  }, [token, repo])

  const saveFile = async (path: string, content: string, message = "Update via CXM"): Promise<boolean> => {
    if (!token || !repo) return false
    try {
      const sha = await fetchFileSha(repo, path, token)
      const success = await commitFile(repo, path, content, sha, message, token)
      if (success) {
        await refreshFiles()
      }
      return success
    } catch (err) {
      setError("Failed to save file")
      return false
    }
  }

  const checkAndCreateContextFolder = async (projectId: string): Promise<boolean> => {
    if (!token) return false
    const proj = projects.find(p => p.id === projectId)
    if (!proj) return false

    try {
      const exists = await checkContextFolderExists(proj.repo, token)
      if (!exists) {
        await createContextFolder(proj.repo, token)
      }
      return true
    } catch {
      setError("Failed to create context folder")
      return false
    }
  }

  const checkAndCreateLlmsTxt = async (projectId: string): Promise<boolean> => {
    if (!token) return false
    const proj = projects.find(p => p.id === projectId)
    if (!proj) return false

    try {
      const exists = await checkLlmsTxtExists(proj.repo, token)
      if (!exists) {
        await createLlmsTxt(proj.repo, token)
      }
      return true
    } catch {
      setError("Failed to create llms.txt")
      return false
    }
  }

  const value: GitHubContextType = {
    isConnected,
    user,
    token,
    projects,
    activeProjectId,
    activeProject,
    repo,
    contextFiles,
    isLoading,
    error,
    isVerifying,
    selectedFile,
    selectedFileContent,
    isLoadingContent,
    connect,
    verifyToken,
    clearError,
    disconnect,
    setActiveProject,
    addProject,
    removeProject,
    updateProject,
    refreshFiles,
    selectFile,
    saveFile,
    checkAndCreateContextFolder,
    checkAndCreateLlmsTxt,
    repoConnected: isConnected && !!repo
  }

  return <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>
}

export function useGitHub() {
  const context = useContext(GitHubContext)
  if (!context) {
    throw new Error("useGitHub must be used within GitHubProvider")
  }
  return context
}
