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

interface GitHubUser {
  login: string
  avatar_url: string
  name?: string
}

export interface Project {
  id: string
  repo: string
  contextFolder: string
  llmsTxtPath: string
  createdAt: number
  hasContextFolder?: boolean
  hasLlmsTxt?: boolean
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
  selectedFile: ContextFile | null
  selectedFileContent: string | null
  isLoadingContent: boolean
  connect: (token: string) => Promise<boolean>
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
}

const GitHubContext = createContext<GitHubContextType | undefined>(undefined)

const STORAGE_KEY = "github_token"
const USER_STORAGE_KEY = "github_user"
const PROJECTS_STORAGE_KEY = "github_projects"
const ACTIVE_PROJECT_KEY = "github_active_project"

export function GitHubProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<ContextFile | null>(null)
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)

  const activeProject = projects.find(p => p.id === activeProjectId) || null
  const repo = activeProject?.repo || null

  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEY)
    const savedUser = localStorage.getItem(USER_STORAGE_KEY)
    const savedProjects = localStorage.getItem(PROJECTS_STORAGE_KEY)
    const savedActiveProject = localStorage.getItem(ACTIVE_PROJECT_KEY)
    
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
      setIsConnected(true)
    }
    
    if (savedProjects) {
      const parsed = JSON.parse(savedProjects)
      setProjects(parsed)
    }
    
    if (savedActiveProject) {
      setActiveProjectId(savedActiveProject)
    }
  }, [])

  const loadContextFiles = useCallback(async () => {
    if (!token || !repo) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const files = await fetchContextFiles(token, repo)
      setContextFiles(files)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files")
      setContextFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [token, repo])

  useEffect(() => {
    if (token && repo) {
      loadContextFiles()
    } else {
      setContextFiles([])
    }
  }, [token, repo, loadContextFiles])

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

  const disconnect = () => {
    setToken(null)
    setUser(null)
    setIsConnected(false)
    setContextFiles([])
    setSelectedFile(null)
    setSelectedFileContent(null)
    
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
  }

  const addProject = (repoPath: string) => {
    const newProject: Project = {
      id: `project_${Date.now()}`,
      repo: repoPath,
      contextFolder: "/context",
      llmsTxtPath: "/llms.txt",
      createdAt: Date.now()
    }
    
    const updated = [...projects, newProject]
    setProjects(updated)
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updated))
    
    if (!activeProjectId) {
      setActiveProjectId(newProject.id)
      localStorage.setItem(ACTIVE_PROJECT_KEY, newProject.id)
    }
  }

  const removeProject = (projectId: string) => {
    const updated = projects.filter(p => p.id !== projectId)
    setProjects(updated)
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updated))
    
    if (activeProjectId === projectId) {
      const newActive = updated[0]?.id || null
      setActiveProjectId(newActive)
      if (newActive) {
        localStorage.setItem(ACTIVE_PROJECT_KEY, newActive)
      } else {
        localStorage.removeItem(ACTIVE_PROJECT_KEY)
      }
    }
  }

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    const updated = projects.map(p => 
      p.id === projectId ? { ...p, ...updates } : p
    )
    setProjects(updated)
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updated))
  }

  const setActiveProject = (projectId: string) => {
    setActiveProjectId(projectId)
    localStorage.setItem(ACTIVE_PROJECT_KEY, projectId)
    setSelectedFile(null)
    setSelectedFileContent(null)
  }

  const refreshFiles = async () => {
    await loadContextFiles()
  }

  const selectFile = useCallback(async (file: ContextFile | null) => {
    setSelectedFile(file)
    
    if (!file || !token || !repo) {
      setSelectedFileContent(null)
      return
    }
    
    setIsLoadingContent(true)
    try {
      const content = await fetchFileContent(token, repo, file.path)
      setSelectedFileContent(content)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load file content")
      setSelectedFileContent(null)
    } finally {
      setIsLoadingContent(false)
    }
  }, [token, repo])

  const saveFile = async (path: string, content: string, message?: string): Promise<boolean> => {
    if (!token || !repo) return false
    
    try {
      const sha = await fetchFileSha(token, repo, path)
      await commitFile(token, repo, path, content, message || `Update ${path}`, sha || undefined)
      await loadContextFiles()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file")
      return false
    }
  }

  const checkAndCreateContextFolder = async (projectId: string): Promise<boolean> => {
    if (!token) return false
    
    const project = projects.find(p => p.id === projectId)
    if (!project) return false
    
    try {
      const exists = await checkContextFolderExists(token, project.repo, project.contextFolder)
      if (!exists) {
        await createContextFolder(token, project.repo, project.contextFolder)
      }
      updateProject(projectId, { hasContextFolder: true })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create context folder")
      return false
    }
  }

  const checkAndCreateLlmsTxt = async (projectId: string): Promise<boolean> => {
    if (!token) return false
    
    const project = projects.find(p => p.id === projectId)
    if (!project) return false
    
    try {
      const exists = await checkLlmsTxtExists(token, project.repo, project.llmsTxtPath)
      if (!exists) {
        await createLlmsTxt(token, project.repo, project.llmsTxtPath)
      }
      updateProject(projectId, { hasLlmsTxt: true })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create llms.txt")
      return false
    }
  }

  return (
    <GitHubContext.Provider
      value={{
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
        selectedFile,
        selectedFileContent,
        isLoadingContent,
        connect,
        disconnect,
        setActiveProject,
        addProject,
        removeProject,
        updateProject,
        refreshFiles,
        selectFile,
        saveFile,
        checkAndCreateContextFolder,
        checkAndCreateLlmsTxt
      }}
    >
      {children}
    </GitHubContext.Provider>
  )
}

export function useGitHub() {
  const context = useContext(GitHubContext)
  if (context === undefined) {
    throw new Error("useGitHub must be used within a GitHubProvider")
  }
  return context
}
