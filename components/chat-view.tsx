"use client"

import { useState, useRef } from "react"
import { Plus, X, Send, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useGitHub } from "@/contexts/github-context"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface ChatViewProps {
  onClose: () => void
}

export function ChatView({ onClose }: ChatViewProps) {
  const { files } = useGitHub()
  const [message, setMessage] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [showFilePicker, setShowFilePicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sort files: README first, then alphabetical
  const sortedFiles = [...files].sort((a, b) => {
    const aIsReadme = /^readme/i.test(a.name)
    const bIsReadme = /^readme/i.test(b.name)
    if (aIsReadme && !bIsReadme) return -1
    if (!aIsReadme && bIsReadme) return 1
    return a.name.localeCompare(b.name)
  })

  const handleSend = () => {
    if (!message.trim()) return
    // TODO: Integrate with AI chat API
    toast.success(`Message sent${selectedFiles.length > 0 ? ` with ${selectedFiles.length} file(s)` : ""}`)
    setMessage("")
    setSelectedFiles([])
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

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Main content area - centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-2xl flex flex-col items-center gap-8">
          {/* Title */}
          <h1 className="text-3xl font-serif text-foreground/90">
            Context is Everything
          </h1>

          {/* Input area */}
          <div className="w-full">
            <div className="relative rounded-xl border bg-card shadow-sm">
              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="How can I help you today?"
                className="w-full resize-none bg-transparent px-4 pt-4 pb-14 text-base placeholder:text-muted-foreground/60 focus:outline-none min-h-[120px]"
                rows={3}
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
                  disabled={!message.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Close to go back to files (subtle) */}
      <div className="flex justify-center pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          Back to files
        </Button>
      </div>
    </div>
  )
}
