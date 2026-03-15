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
  if (!markdown) return "<p></p>"
  
  const lines = markdown.split("\n")
  const result: string[] = []
  let inList = false
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    
    // Apply inline formatting
    line = line
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
    
    // Check line type
    if (line.startsWith("## ")) {
      if (inList) { result.push("</ul>"); inList = false }
      result.push(`<h2>${line.slice(3)}</h2>`)
    } else if (line.startsWith("# ")) {
      if (inList) { result.push("</ul>"); inList = false }
      result.push(`<h1>${line.slice(2)}</h1>`)
    } else if (line.startsWith("- ")) {
      if (!inList) { result.push("<ul>"); inList = true }
      result.push(`<li><p>${line.slice(2)}</p></li>`)
    } else if (line.startsWith("* ")) {
      if (!inList) { result.push("<ul>"); inList = true }
      result.push(`<li><p>${line.slice(2)}</p></li>`)
    } else if (line.trim() === "") {
      if (inList) { result.push("</ul>"); inList = false }
      // Skip empty lines, Tiptap handles spacing
    } else {
      if (inList) { result.push("</ul>"); inList = false }
      result.push(`<p>${line}</p>`)
    }
  }
  
  if (inList) result.push("</ul>")
  
  return result.join("") || "<p></p>"
}

// Convert HTML back to markdown
function htmlToMarkdown(html: string): string {
  if (!html) return ""
  
  let result = html
    // Handle headings first
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, content) => `# ${stripTags(content)}\n\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, content) => `## ${stripTags(content)}\n\n`)
    // Handle list items - extract text content
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => `- ${stripTags(content)}\n`)
    // Remove ul tags
    .replace(/<ul[^>]*>/gi, "")
    .replace(/<\/ul>/gi, "\n")
    // Handle paragraphs
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => {
      const text = content
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
        .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
        .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
        .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
      return text + "\n\n"
    })
    // Handle any remaining inline formatting
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    .replace(/<br\s*\/?>/gi, "\n")
    // Clean up remaining tags
    .replace(/<[^>]+>/g, "")
    // Clean up whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  
  return result
}

function stripTags(html: string): string {
  return html
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    .replace(/<[^>]+>/g, "")
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
          "flex-1 w-full text-sm leading-relaxed outline-none",
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

      {/* Tiptap Editor - with proper overflow handling */}
      <div className="flex-1 overflow-y-auto p-4">
        <EditorContent editor={editor} />
      </div>
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
