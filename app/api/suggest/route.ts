import { NextRequest, NextResponse } from "next/server"

const RESTACKED_API_URL = process.env.RESTACKED_API_URL || "https://api.restacked.ai/v1"
const RESTACKED_API_TOKEN = process.env.RESTACKED_API_TOKEN || "be8b3d73-7241-4b30-ba99-9a3696f5e7af"

export async function POST(request: NextRequest) {
  try {
    const { aiResponse, documentContent, documentName } = await request.json()

    const systemPrompt = `You are a document improvement assistant. Given an AI response and the original document content, generate a specific suggestion to improve the document.

Your task:
1. Analyze the AI response for any information that could improve the document
2. Find the most relevant section in the document that should be modified
3. Generate a BEFORE and AFTER comparison

Respond ONLY in this exact JSON format (no markdown, no code blocks):
{
  "summary": "Brief description of the change",
  "before": "The exact text from the document that should be changed (or 'New section' if adding new content)",
  "after": "The improved/updated text that should replace the before text",
  "section": "The section name or location in the document"
}

Important:
- Keep the before/after text concise but complete
- Match the document's existing formatting style
- If the AI response contains new information not in the document, suggest adding a new section
- The "before" should be actual text from the document when modifying existing content`

    const userPrompt = `Document: "${documentName}"

Current document content:
---
${documentContent}
---

AI Response to incorporate:
---
${aiResponse}
---

Generate a suggestion to improve the document based on this AI response.`

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
    const content = data.choices?.[0]?.message?.content || "{}"
    
    // Parse the JSON response
    try {
      // Clean up the response - remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const suggestion = JSON.parse(cleanContent)
      return NextResponse.json(suggestion)
    } catch (parseError) {
      console.error("[v0] Failed to parse suggestion JSON:", content)
      return NextResponse.json({
        summary: "Suggested improvement based on conversation",
        before: "Original content",
        after: aiResponse.slice(0, 500),
        section: "Document"
      })
    }
  } catch (error) {
    console.error("[v0] Suggest API error:", error)
    return NextResponse.json(
      { error: "Failed to generate suggestion" },
      { status: 500 }
    )
  }
}
