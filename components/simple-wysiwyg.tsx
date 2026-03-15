"use client"

import { useRef, useCallback, useEffect, useState } from "react"
import { Bold, Italic, Heading2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SimpleWysiwygProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SimpleWysiwyg({ value, onChange, placeholder, className }: SimpleWysiwygProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isUpdatingFromProp, setIsUpdatingFromProp] = useState(false)

  // Convert markdown to styled HTML for display
  const getDisplayHTML = useCallback((text: string) => {
    if (!text) return ""
    
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/^## (.+)$/gm, "<div class='text-lg font-semibold mt-3 mb-1.5'>$1</div>")
      .replace(/^# (.+)$/gm, "<div class='text-xl font-bold mt-4 mb-2'>$1</div>")
      .replace(/\*\*(.+?)\*\*/g, "<strong class='font-semibold'>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em class='italic'>$1</em>")
      .replace(/`([^`]+)`/g, "<code class='bg-muted px-1 py-0.5 rounded text-xs font-mono'>$1</code>")
      .replace(/^- (.+)$/gm, "<div class='ml-4 my-1'>• $1</div>")
      .replace(/\n\n/g, "<div class='h-2'></div>")
      .replace(/\n/g, "<br>")
  }, [])

  // Extract plain text from editor (strips HTML but keeps markdown structure)
  const extractMarkdown = useCallback(() => {
    if (!editorRef.current) return value

    const html = editorRef.current.innerHTML
    let text = html
      .replace(/<div[^>]*class='text-lg[^']*'[^>]*>(.+?)<\/div>/g, "## $1")
      .replace(/<div[^>]*class='text-xl[^']*'[^>]*>(.+?)<\/div>/g, "# $1")
      .replace(/<strong[^>]*class='font-semibold'[^>]*>(.+?)<\/strong>/g, "**$1**")
      .replace(/<em[^>]*class='italic'[^>]*>(.+?)<\/em>/g, "*$1*")
      .replace(/<code[^>]*class='bg-muted[^']*'[^>]*>(.+?)<\/code>/g, "`$1`")
      .replace(/<div[^>]*class='ml-4[^']*'[^>]*>• (.+?)<\/div>/g, "- $1")
      .replace(/<div class='h-2'><\/div>/g, "\n")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")

    // Clean up excessive whitespace
    return text.replace(/\n\n+/g, "\n\n").trim()
  }, [value])

  // Update editor when prop changes
  useEffect(() => {
    if (!editorRef.current || isUpdatingFromProp) return
    
    setIsUpdatingFromProp(true)
    const html = getDisplayHTML(value)
    editorRef.current.innerHTML = html || `<div class='text-muted-foreground'>${placeholder || "Start writing..."}</div>`
    setIsUpdatingFromProp(false)
  }, [value, getDisplayHTML, placeholder])

  const handleInput = useCallback(() => {
    if (isUpdatingFromProp) return
    
    const markdown = extractMarkdown()
    if (markdown !== value) {
      onChange(markdown)
    }
  }, [isUpdatingFromProp, value, extractMarkdown, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === "b") {
        e.preventDefault()
        document.execCommand("bold", false)
      } else if (e.key === "i") {
        e.preventDefault()
        document.execCommand("italic", false)
      }
    }
  }, [])

  const insertFormatting = useCallback((before: string, after: string) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const selectedText = range.toString()
    
    const span = document.createElement("span")
    span.innerHTML = before + selectedText + after
    range.deleteContents()
    range.insertNode(span)

    editorRef.current?.focus()
    handleInput()
  }, [handleInput])

  const insertAtLineStart = useCallback((prefix: string) => {
    const selection = window.getSelection()
    if (!selection || !editorRef.current) return

    const div = document.createElement("div")
    div.className = prefix === "## " ? "text-lg font-semibold mt-3 mb-1.5" : ""
    div.textContent = prefix
    editorRef.current.appendChild(div)
    
    editorRef.current.focus()
    handleInput()
  }, [handleInput])

  return (
    <div className={cn("flex flex-col border rounded-md overflow-hidden bg-background", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b bg-muted/40 px-2 py-1.5">
        <ToolbarButton 
          onClick={() => insertFormatting("**", "**")} 
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => insertFormatting("*", "*")} 
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarButton 
          onClick={() => insertAtLineStart("## ")} 
          title="Heading"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* WYSIWYG Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex-1 min-h-[300px] p-4 text-sm leading-relaxed outline-none overflow-y-auto",
          "bg-transparent focus:ring-0",
          "prose prose-sm max-w-none",
          "[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground"
        )}
        data-placeholder={placeholder || "Start writing..."}
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
        e.preventDefault()
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
