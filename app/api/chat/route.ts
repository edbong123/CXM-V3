import { NextRequest, NextResponse } from "next/server"

const RESTACKED_API_URL = process.env.RESTACKED_API_URL || "https://api.restacked.ai/v1"
const RESTACKED_API_TOKEN = process.env.RESTACKED_API_TOKEN || "be8b3d73-7241-4b30-ba99-9a3696f5e7af"

export async function POST(request: NextRequest) {
  try {
    const { messages, attachedFiles, fileContents } = await request.json()

    // Build the system prompt with actual file contents
    let systemPrompt = `You are a helpful AI assistant working with context documents. Help users with questions, suggestions, and improvements related to their documents.`
    
    if (fileContents && Object.keys(fileContents).length > 0) {
      systemPrompt += `\n\nThe user has attached the following documents:\n`
      for (const [fileName, content] of Object.entries(fileContents)) {
        systemPrompt += `\n--- Document: ${fileName} ---\n${content}\n--- End of ${fileName} ---\n`
      }
      systemPrompt += `\nUse this document content to provide accurate and helpful responses. When suggesting changes, reference specific sections from the documents.`
    } else if (attachedFiles?.length > 0) {
      systemPrompt += `\n\nThe user mentioned these documents: ${attachedFiles.join(", ")}. However, the content was not provided.`
    }

    const response = await fetch(`${RESTACKED_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESTACKED_API_TOKEN}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        user: "context-maintainer-user",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Restacked API error:", response.status, errorText)
      return NextResponse.json(
        { error: `API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const assistantMessage = data.choices?.[0]?.message?.content || "I couldn't generate a response."

    return NextResponse.json({ content: assistantMessage })
  } catch (error) {
    console.error("[v0] Chat API error:", error)
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    )
  }
}
