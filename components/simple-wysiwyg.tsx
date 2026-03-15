"use client"

import { useRef, useCallback } from "react"
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

  const execCmd = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }, [])

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  // Convert plain text/markdown to basic HTML for display
  const htmlValue = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>")

  return (
    <div className={cn("flex flex-col border rounded-md overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b bg-muted/40 px-2 py-1.5">
        <ToolbarButton onClick={() => execCmd("bold")} title="Bold (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCmd("italic")} title="Italic (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarButton onClick={() => execCmd("formatBlock", "h2")} title="Heading">
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: htmlValue }}
        data-placeholder={placeholder || "Start writing..."}
        className={cn(
          "flex-1 min-h-[300px] p-4 text-sm leading-relaxed outline-none overflow-y-auto",
          "prose prose-sm max-w-none",
          "[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground",
          "[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mb-2 [&_h1]:mt-4",
          "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-1.5 [&_h2]:mt-3",
          "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1 [&_h3]:mt-2.5",
          "[&_strong]:font-semibold",
          "[&_em]:italic"
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
