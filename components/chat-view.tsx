"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, X, Send, FileText, Sparkles, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useGitHub } from "@/contexts/github-context"
import { useSuggestions } from "@/contexts/suggestions-context"
import { fetchFileContent } from "@/lib/github-client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface SuggestedChange {
  summary: string
  before?: string
  after: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  attachedFiles: string[]
  // pending = has suggestion available but not shown yet
  // loading = generating suggestion from API
  // shown = formatted diff card is visible
  // added = suggestion has been added to the database
  suggestionState?: "pending" | "loading" | "shown" | "added"
  suggestedChange?: SuggestedChange
}

interface ChatViewProps {
  onClose: () => void
  initialFile?: string | null
  initialMode?: "suggest" | "ask-questions" | null
}

export function ChatView({ onClose, initialFile, initialMode }: ChatViewProps) {
  const { files, llmFile, token, repo } = useGitHub()
  const { addSuggestion } = useSuggestions()
  const [message, setMessage] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<string[]>(initialFile ? [initialFile] : [])
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [hasTriggeredInitialMode, setHasTriggeredInitialMode] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Handle "ask-questions" mode - auto-send a prompt to ask the AI to ask questions
  useEffect(() => {
    if (initialMode === "ask-questions" && initialFile && !hasTriggeredInitialMode && token && repo) {
      setHasTriggeredInitialMode(true)
      
      const askQuestionsPrompt = `Please review the "${initialFile}" document and ask me clarifying questions to help complete or improve it. Focus on missing information, unclear sections, or areas that could be expanded.`
      
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: askQuestionsPrompt,
        attachedFiles: [initialFile]
      }
      setMessages([userMessage])
      setIsTyping(true)

      // Fetch file content first, then call API
      const allFiles = [...files, llmFile].filter(Boolean)
      const file = allFiles.find(f => f?.name.replace(/\.(md|txt)$/, "") === initialFile)
      
      const fetchAndAsk = async () => {
        const fileContents: Record<string, string> = {}
        if (file) {
          try {
            const content = await fetchFileContent(token, repo, file.path)
            fileContents[initialFile] = content
          } catch (e) {
            console.error(`[v0] Failed to fetch content for ${initialFile}:`, e)
          }
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: askQuestionsPrompt }],
            attachedFiles: [initialFile],
            fileContents
          })
        })
        
        const data = await res.json()
        const aiResponse: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.content,
          attachedFiles: []
        }
        setMessages(prev => [...prev, aiResponse])
      }

      fetchAndAsk()
        .catch(() => {
          const errorMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: "Sorry, I encountered an error. Please try again.",
            attachedFiles: []
          }
          setMessages(prev => [...prev, errorMessage])
        })
        .finally(() => setIsTyping(false))
    }
  }, [initialMode, initialFile, hasTriggeredInitialMode, token, repo, files, llmFile])

  // Sort files: README first, then alphabetical
  const sortedFiles = [...files].sort((a, b) => {
    const aIsReadme = /^readme/i.test(a.name)
    const bIsReadme = /^readme/i.test(b.name)
    if (aIsReadme && !bIsReadme) return -1
    if (!aIsReadme && bIsReadme) return 1
    return a.name.localeCompare(b.name)
  })

  const simulateAIResponse = (userMessage: string, attachedFiles: string[]) => {
    // Check if message is about address change
    const isAddressChange = /address|location|office|move|relocate|street|city/i.test(userMessage)
    const hasCompanyFile = attachedFiles.some(f => /company/i.test(f))

    if (isAddressChange && hasCompanyFile) {
      // Extract potential address from message
      const addressMatch = userMessage.match(/\d+.*(?:street|st|avenue|ave|road|rd|blvd|drive|dr|way|lane|ln)/i)
      const newAddress = addressMatch ? addressMatch[0] : "123 Innovation Way, Suite 400"
      
      return {
        content: `I can help you update the company address. Based on your message, here's a properly formatted address update for the Company document:`,
        suggestedChange: {
          summary: "Update company headquarters address",
          before: "**Headquarters:** San Francisco, CA (Remote-first)",
          after: `**Headquarters:** ${newAddress}\nSan Francisco, CA 94105\n\n*Remote-first with optional in-person collaboration days*`
        }
      }
    }

    // Default response
    return {
      content: `I understand you'd like help with "${userMessage.slice(0, 50)}${userMessage.length > 50 ? '...' : ''}". ${attachedFiles.length > 0 ? `I've reviewed the attached context file${attachedFiles.length > 1 ? 's' : ''} (${attachedFiles.join(', ')}).` : ''}\n\nHow would you like me to proceed? I can suggest specific changes to your context documents.`,
      suggestedChange: undefined
    }
  }

  const handleSend = async () => {
    if (!message.trim()) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      attachedFiles: [...selectedFiles]
    }

    setMessages(prev => [...prev, userMessage])
    const sentMessage = message
    const sentFiles = [...selectedFiles]
    setMessage("")
    setIsTyping(true)

    try {
      // Fetch content for attached files
      const allFiles = [...files, llmFile].filter(Boolean)
      const fileContents: Record<string, string> = {}
      
      for (const fileName of sentFiles) {
        const file = allFiles.find(f => f?.name.replace(/\.(md|txt)$/, "") === fileName)
        if (file && token && repo) {
          try {
            const content = await fetchFileContent(token, repo, file.path)
            fileContents[fileName] = content
          } catch (e) {
            console.error(`[v0] Failed to fetch content for ${fileName}:`, e)
          }
        }
      }

      // Call the Restacked API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: sentMessage }].map(m => ({
            role: m.role,
            content: m.content
          })),
          attachedFiles: sentFiles,
          fileContents
        })
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.content,
        attachedFiles: sentFiles,
        suggestionState: "pending", // Always offer suggestion option
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error("[v0] Chat error:", error)
      const errorMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again.",
        attachedFiles: []
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const handleShowSuggestion = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId)
    if (!msg || msg.attachedFiles.length === 0) return

    // Mark as loading
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, suggestionState: "loading" } : m
    ))

    try {
      // Get the attached file content
      const fileName = msg.attachedFiles[0]
      const allFiles = [...files, llmFile].filter(Boolean)
      const file = allFiles.find(f => f?.name.replace(/\.(md|txt)$/, "") === fileName)
      
      let documentContent = ""
      if (file && token && repo) {
        documentContent = await fetchFileContent(token, repo, file.path)
      }

      // Call the suggest API
      const response = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiResponse: msg.content,
          documentContent,
          documentName: fileName
        })
      })

      if (!response.ok) throw new Error("Failed to generate suggestion")

      const suggestion = await response.json()

      // Update the message with the generated suggestion
      setMessages(prev => prev.map(m =>
        m.id === msgId ? {
          ...m,
          suggestionState: "shown",
          suggestedChange: {
            summary: suggestion.summary,
            before: suggestion.before,
            after: suggestion.after
          }
        } : m
      ))
    } catch (error) {
      console.error("[v0] Failed to generate suggestion:", error)
      toast.error("Failed to generate suggestion")
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, suggestionState: "pending" } : m
      ))
    }
  }

  const handleSuggestAsContext = (msg: Message) => {
    if (!msg.suggestedChange || msg.attachedFiles.length === 0) return
    
    const fileName = msg.attachedFiles[0]
    
    // Add to suggestions context so it appears in the Suggestions tab
    addSuggestion({
      fileName,
      summary: msg.suggestedChange.summary,
      before: msg.suggestedChange.before,
      after: msg.suggestedChange.after
    })
    
    toast.success(`Suggestion added to ${fileName}`, {
      description: "View it in the Suggestions tab"
    })
    
    // Mark the suggestion as added
    setMessages(prev => prev.map(m =>
      m.id === msg.id ? { ...m, suggestionState: "added" as Message["suggestionState"] } : m
    ))
  }

  const renderMarkdown = (text: string) => {
    // Parse simple markdown: **bold**, *italic*, `code`
    const parts: (string | { type: "bold" | "italic" | "code"; text: string })[] = []
    let remaining = text
    let i = 0

    while (i < remaining.length) {
      // Match **bold**
      const boldMatch = remaining.slice(i).match(/^\*\*(.+?)\*\*/)
      if (boldMatch) {
        parts.push({ type: "bold", text: boldMatch[1] })
        i += boldMatch[0].length
        continue
      }

      // Match *italic*
      const italicMatch = remaining.slice(i).match(/^\*(.+?)\*/)
      if (italicMatch) {
        parts.push({ type: "italic", text: italicMatch[1] })
        i += italicMatch[0].length
        continue
      }

      // Match `code`
      const codeMatch = remaining.slice(i).match(/^`(.+?)`/)
      if (codeMatch) {
        parts.push({ type: "code", text: codeMatch[1] })
        i += codeMatch[0].length
        continue
      }

      // Regular text until next markdown
      const nextMarkdown = remaining.slice(i).search(/(\*\*|\*|`)/)
      if (nextMarkdown === -1) {
        parts.push(remaining.slice(i))
        break
      } else {
        parts.push(remaining.slice(i, i + nextMarkdown))
        i += nextMarkdown
      }
    }

    return parts.map((part, idx) => {
      if (typeof part === "string") return <span key={idx}>{part}</span>
      if (part.type === "bold") return <strong key={idx}>{part.text}</strong>
      if (part.type === "italic") return <em key={idx}>{part.text}</em>
      if (part.type === "code")
        return (
          <code key={idx} className="bg-muted px-1 rounded text-xs font-mono">
            {part.text}
          </code>
        )
    })
  }

  const addFile = (fileName: string) => {
    if (!selectedFiles.includes(fileName)) {
      setSelectedFiles([...selectedFiles, fileName])
    }
    setShowFilePicker(false)
  }

  const removeFile = (fileName: string) => {
    setSelectedFiles(selectedFiles.filter(f => f !== fileName))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages area or empty state */}
      {hasMessages ? (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3",
                  msg.role === "user" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted"
                )}>
                  {/* Show attached files for user messages */}
                  {msg.role === "user" && msg.attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {msg.attachedFiles.map(file => (
                        <Badge key={file} variant="secondary" className="bg-primary-foreground/20 text-primary-foreground text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          {file}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                  {/* Pending: small inline button */}
                  {msg.role === "assistant" && msg.suggestionState === "pending" && msg.attachedFiles.length > 0 && (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() => handleShowSuggestion(msg.id)}
                      >
                        <Sparkles className="h-3 w-3" />
                        Suggest as context
                      </Button>
                    </div>
                  )}

                  {/* Loading: generating suggestion */}
                  {msg.role === "assistant" && msg.suggestionState === "loading" && (
                    <div className="mt-4 bg-background rounded-lg border p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating suggestion...
                      </div>
                    </div>
                  )}

                  {/* Shown: full formatted diff card */}
                  {msg.role === "assistant" && msg.suggestionState === "shown" && msg.suggestedChange && (
                    <div className="mt-4 bg-background rounded-lg border p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Suggested Change
                      </div>

                      {msg.suggestedChange.before && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Before</p>
                          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded px-3 py-2 text-sm text-red-800 dark:text-red-200">
                            {renderMarkdown(msg.suggestedChange.before)}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">After</p>
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                          {renderMarkdown(msg.suggestedChange.after)}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="default"
                        className="w-full gap-2 mt-2"
                        onClick={() => handleSuggestAsContext(msg)}
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                        Add to Suggestions
                      </Button>
                    </div>
                  )}

                  {/* Added: confirmation that suggestion was added */}
                  {msg.role === "assistant" && msg.suggestionState === "added" && (
                    <div className="mt-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                      <Sparkles className="h-4 w-4" />
                      Suggestion added to document
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-2xl flex flex-col items-center gap-8">
            {/* Title */}
            <h1 className="text-3xl font-serif text-foreground/90">
              Context is Everything
            </h1>
          </div>
        </div>
      )}

      {/* Input area - always at bottom */}
      <div className={cn(
        "px-6 pb-6",
        hasMessages ? "pt-2" : "pt-0"
      )}>
        <div className="max-w-2xl mx-auto">
          <div className="relative rounded-xl border bg-card shadow-sm">
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="How can I help you today?"
              className="w-full resize-none bg-transparent px-4 pt-4 pb-14 text-base placeholder:text-muted-foreground/60 focus:outline-none min-h-[100px]"
              rows={2}
            />

            {/* Bottom bar with + button, chips, and send */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2.5 border-t bg-card/80 rounded-b-xl">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Add file button */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowFilePicker(!showFilePicker)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>

                  {/* File picker dropdown */}
                  {showFilePicker && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-popover border rounded-lg shadow-lg overflow-hidden z-50">
                      <div className="max-h-60 overflow-y-auto">
                        {sortedFiles.length === 0 ? (
                          <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                            No context files available
                          </p>
                        ) : (
                          sortedFiles.map(file => {
                            const displayName = file.name.replace(/\.md$/, "")
                            const isSelected = selectedFiles.includes(displayName)
                            return (
                              <button
                                key={file.path}
                                onClick={() => addFile(displayName)}
                                disabled={isSelected}
                                className={cn(
                                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors",
                                  isSelected
                                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                                    : "hover:bg-accent hover:text-accent-foreground"
                                )}
                              >
                                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="truncate">{displayName}</span>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected file chips */}
                {selectedFiles.map(fileName => (
                  <Badge
                    key={fileName}
                    variant="secondary"
                    className="gap-1 pr-1 bg-primary/10 text-primary border-primary/20"
                  >
                    <FileText className="h-3 w-3" />
                    {fileName}
                    <button
                      onClick={() => removeFile(fileName)}
                      className="ml-0.5 h-4 w-4 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              {/* Send button */}
              <Button
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={handleSend}
                disabled={!message.trim() || isTyping}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
