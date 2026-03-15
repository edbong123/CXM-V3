import { NextRequest, NextResponse } from "next/server"

const RESTACKED_API_URL = process.env.RESTACKED_API_URL || "https://api.restacked.ai/v1"
const RESTACKED_API_TOKEN = process.env.RESTACKED_API_TOKEN || "be8b3d73-7241-4b30-ba99-9a3696f5e7af"

interface Suggestion {
  id: string
  summary: string
  before?: string
  after: string
}

export async function POST(request: NextRequest) {
  try {
    const { documentContent, documentName, acceptedSuggestions } = await request.json() as {
      documentContent: string
      documentName: string
      acceptedSuggestions: Suggestion[]
    }

    if (!acceptedSuggestions || acceptedSuggestions.length === 0) {
      return NextResponse.json({ newContent: documentContent })
    }

    const systemPrompt = `You are a document editor assistant. Your task is to incorporate the accepted suggestions into the document while maintaining its style, structure, and formatting.

Rules:
1. Apply all the accepted changes naturally and coherently
2. Maintain the document's existing markdown formatting
3. Ensure smooth transitions between sections
4. Keep the document's tone and style consistent
5. Do not add any commentary or explanations
6. If a suggestion adds new content (no "before" text), integrate it in the most appropriate location
7. Preserve all existing content that is not being modified

Return a JSON object with exactly two fields:
- "newContent": the complete updated document as a string
- "commitSummary": a single concise sentence (max 72 chars) describing what was changed, suitable as a git commit message`

    const suggestionsText = acceptedSuggestions.map((s, i) => {
      if (s.before) {
        return `Suggestion ${i + 1}: "${s.summary}"
- Replace: "${s.before}"
- With: "${s.after}"`
      } else {
        return `Suggestion ${i + 1}: "${s.summary}"
- Add new content: "${s.after}"`
      }
    }).join("\n\n")

    const userPrompt = `Document: "${documentName}"

Current document content:
---
${documentContent}
---

Accepted suggestions to incorporate:
---
${suggestionsText}
---

Generate the complete updated document with all accepted suggestions incorporated.`

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
        response_format: { type: "json_object" },
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
    const rawMessage = data.choices?.[0]?.message?.content || "{}"
    
    let newContent = documentContent
    let commitSummary = ""
    
    try {
      const parsed = JSON.parse(rawMessage)
      newContent = parsed.newContent || documentContent
      commitSummary = parsed.commitSummary || ""
    } catch {
      // If JSON parsing fails, treat the raw message as the document content
      newContent = rawMessage || documentContent
    }

    return NextResponse.json({ newContent, commitSummary })
  } catch (error) {
    console.error("[v0] Process suggestions API error:", error)
    return NextResponse.json(
      { error: "Failed to process suggestions" },
      { status: 500 }
    )
  }
}
