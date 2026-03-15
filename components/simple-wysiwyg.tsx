"use client"

import { useRef, useCallback } from "react"
import { Bold, Italic, Heading2, List, Code } from "lucide-react"
import { cn } from "@/lib/utils"

interface SimpleWysiwygProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SimpleWysiwyg({ value, onChange, placeholder, className }: SimpleWysiwygProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const wrapSelection = useCallback((before: string, after: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.substring(start, end)
    const newValue = value.substring(0, start) + before + selected + after + value.substring(end)
    
    onChange(newValue)
    
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, end + before.length)
    })
  }, [value, onChange])

  const insertAtLineStart = useCallback((prefix: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    // Find the start of the current line
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    const newValue = value.substring(0, lineStart) + prefix + value.substring(lineStart)
    
    onChange(newValue)
    
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length)
    })
  }, [value, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === "b") {
        e.preventDefault()
        wrapSelection("**", "**")
      } else if (e.key === "i") {
        e.preventDefault()
        wrapSelection("*", "*")
      }
    }
  }, [wrapSelection])

  return (
    <div className={cn("flex flex-col border rounded-md overflow-hidden bg-background", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b bg-muted/40 px-2 py-1.5">
        <ToolbarButton onClick={() => wrapSelection("**", "**")} title="Bold (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => wrapSelection("*", "*")} title="Italic (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarButton onClick={() => insertAtLineStart("## ")} title="Heading">
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => insertAtLineStart("- ")} title="List item">
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => wrapSelection("`", "`")} title="Inline code">
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Textarea Editor */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Start writing..."}
        className={cn(
          "flex-1 min-h-[300px] p-4 text-sm leading-relaxed outline-none resize-none",
          "font-mono bg-transparent",
          "placeholder:text-muted-foreground"
        )}
      />
    </div>
  )
}

function ToolbarButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault() // prevent losing editor focus
        onClick()
      }}
      title={title}
      className={cn(
        "h-7 w-7 flex items-center justify-center rounded",
        "text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      )}
    >
      {children}
    </button>
  )
}
