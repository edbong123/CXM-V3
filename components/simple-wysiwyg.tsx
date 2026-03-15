"use client"

import { useEffect, useCallback } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { Bold, Italic, Heading2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SimpleWysiwygProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

// Convert markdown to HTML for Tiptap
function markdownToHtml(markdown: string): string {
  if (!markdown) return ""
  
  return markdown
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith("<h") || match.startsWith("<ul") || match.startsWith("<li") || match.startsWith("</")) {
        return match
      }
      return `<p>${match}</p>`
    })
}

// Convert HTML back to markdown
function htmlToMarkdown(html: string): string {
  if (!html) return ""
  
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<ul[^>]*>|<\/ul>/gi, "")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function SimpleWysiwyg({ value, onChange, placeholder, className }: SimpleWysiwygProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Start writing...",
      }),
    ],
    content: markdownToHtml(value),
    editorProps: {
      attributes: {
        class: cn(
          "flex-1 min-h-[300px] p-4 text-sm leading-relaxed outline-none overflow-y-auto",
          "prose prose-sm max-w-none",
          "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2",
          "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5",
          "[&_p]:my-1",
          "[&_ul]:list-disc [&_ul]:ml-4",
          "[&_li]:my-0.5"
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const markdown = htmlToMarkdown(html)
      onChange(markdown)
    },
  })

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (editor && value !== htmlToMarkdown(editor.getHTML())) {
      editor.commands.setContent(markdownToHtml(value))
    }
  }, [editor, value])

  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run()
  }, [editor])

  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run()
  }, [editor])

  const toggleHeading = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 2 }).run()
  }, [editor])

  return (
    <div className={cn("flex flex-col border rounded-md overflow-hidden bg-background", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b bg-muted/40 px-2 py-1.5">
        <ToolbarButton 
          onClick={toggleBold} 
          title="Bold (Ctrl+B)"
          active={editor?.isActive("bold")}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={toggleItalic} 
          title="Italic (Ctrl+I)"
          active={editor?.isActive("italic")}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarButton 
          onClick={toggleHeading} 
          title="Heading"
          active={editor?.isActive("heading", { level: 2 })}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Tiptap Editor */}
      <EditorContent editor={editor} className="flex-1" />
    </div>
  )
}

function ToolbarButton({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  title?: string
  active?: boolean
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
        "h-7 w-7 flex items-center justify-center rounded transition-colors",
        active 
          ? "bg-accent text-foreground" 
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {children}
    </button>
  )
}
