# CXM-APP.md — Context Manager Application

## What This Is

The Context Manager (CXM) is a web application for managing AI context files stored in a GitHub repository. It provides a UI for viewing, editing, and maintaining context documents that follow the Restacked context orchestration system.

**Status:** Prototype / Pre-MVP  
**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui  
**Deployment:** Vercel  

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        App Shell (page.tsx)                     │
│  ┌──────────────┐  ┌─────────────────────────────────────────┐  │
│  │ContextFiles  │  │              Main Panel                 │  │
│  │    List      │  │  ┌─────────────────────────────────┐    │  │
│  │              │  │  │  FileViewer (tabs: view/edit/   │    │  │
│  │  - File nav  │  │  │  suggestions/history)           │    │  │
│  │  - Counts    │  │  └─────────────────────────────────┘    │  │
│  │  - Actions   │  │              OR                         │  │
│  │              │  │  ┌─────────────────────────────────┐    │  │
│  │              │  │  │  ChatView (LLM interaction)     │    │  │
│  │              │  │  └─────────────────────────────────┘    │  │
│  └──────────────┘  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │    Contexts       │
                    │  - GitHubContext  │
                    │  - Suggestions    │
                    └───────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   API Routes      │
                    │  - /api/chat      │
                    │  - /api/suggest   │
                    │  - /api/process   │
                    └───────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  External APIs    │
                    │  - GitHub API     │
                    │  - Restacked LLM  │
                    └───────────────────┘
```

---

## Core Components

### Page & Layout

| File | Responsibility |
|------|----------------|
| `app/page.tsx` | App shell, routing between ChatView and FileViewer, header, settings |
| `app/layout.tsx` | Root layout, fonts (Poppins, Lora, Geist Mono), metadata |
| `app/globals.css` | Design tokens, Claude-inspired warm palette |

### Main Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **ContextFilesList** | `components/context-files-list.tsx` | Left sidebar, file navigation, suggestion count badges, file CRUD |
| **FileViewer** | `components/file-viewer.tsx` | Tabbed view (View/Edit/Suggestions/History), markdown rendering, save to GitHub |
| **ChatView** | `components/chat-view.tsx` | LLM chat interface, suggestion generation, file attachment |
| **SuggestionsPanel** | `components/suggestions-panel.tsx` | Review suggestions, accept/reject/defer, process with LLM |
| **SettingsPanel** | `components/settings-panel.tsx` | GitHub PAT and repo configuration |
| **SimpleWYSIWYG** | `components/simple-wysiwyg.tsx` | Markdown editor with toolbar |

### Contexts (State Management)

| Context | File | State |
|---------|------|-------|
| **GitHubContext** | `contexts/github-context.tsx` | Token, repo, files, selectedFile, fileContent, commits |
| **SuggestionsContext** | `contexts/suggestions-context.tsx` | Suggestions array, status tracking (pending/accepted/rejected/later/processed) |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | General LLM chat, streaming responses |
| `/api/suggest` | POST | Generate structured suggestions for a file |
| `/api/process-suggestions` | POST | Apply accepted suggestions via LLM, returns new content + commit summary |

### Libraries

| File | Purpose |
|------|---------|
| `lib/github-client.ts` | GitHub API wrapper (fetch files, commits, create/update/delete) |
| `lib/mock-suggestions.ts` | Empty placeholder for mock data (cleared) |
| `lib/utils.ts` | cn() utility for Tailwind class merging |

---

## Data Flow

### 1. File Loading
```
User connects GitHub → GitHubContext fetches /context/*.md files
→ ContextFilesList displays files with suggestion counts
→ User clicks file → FileViewer renders content
```

### 2. Suggestion Generation
```
User opens ChatView → Selects file(s) → Sends message
→ /api/suggest generates structured suggestion
→ SuggestionsContext.addSuggestion() stores it
→ FileViewer Suggestions tab shows it
```

### 3. Processing Suggestions
```
User accepts suggestions → Clicks "Process Suggestions"
→ /api/process-suggestions sends doc + accepted items to LLM
→ LLM returns revised document + commit summary
→ FileViewer shows diff in review mode
→ User saves → GitHub commit
```

### 4. Status Lifecycle
```
Suggestion created → status: "pending"
User accepts → status: "accepted"
User rejects → status: "rejected" (hidden)
User defers → status: "later" (deferred list)
Process runs → status: "processed" (hidden)
```

---

## API Contracts

### POST /api/chat
```typescript
Request: {
  messages: { role: "user" | "assistant", content: string }[]
  contextFiles?: { name: string, content: string }[]
}
Response: ReadableStream (text/event-stream)
```

### POST /api/suggest
```typescript
Request: {
  documentContent: string
  documentName: string
  userMessage: string
  contextFiles?: { name: string, content: string }[]
}
Response: {
  summary: string
  before?: string
  after: string
}
```

### POST /api/process-suggestions
```typescript
Request: {
  documentContent: string
  documentName: string
  acceptedSuggestions: {
    id: string
    summary: string
    before?: string
    after: string
  }[]
}
Response: {
  newContent: string
  commitSummary: string
}
```

---

## Design System

### Palette (Claude-inspired)
- **Background:** Warm ivory `oklch(0.975 0.006 85)` (#faf9f5)
- **Primary:** Terracotta `oklch(0.62 0.16 40)` (#d97757)
- **Foreground:** Dark charcoal `oklch(0.14 0.005 85)`
- **Muted:** Warm gray `oklch(0.55 0.01 85)`

### Typography
- **Sans (UI):** Poppins 400/500/600
- **Serif (Editorial):** Lora 400/500/600
- **Mono (Code):** Geist Mono

### Components
- shadcn/ui base components
- Custom tabs: pill-style, rounded, subtle shadows
- Suggestion badges: terracotta accent with count

---

## Current Capabilities

| Feature | Status |
|---------|--------|
| GitHub authentication (PAT) | Done |
| Repository connection | Done |
| File listing from /context/ | Done |
| Markdown viewing | Done |
| Markdown editing (WYSIWYG) | Done |
| Commit history viewing | Done |
| LLM chat interface | Done |
| Suggestion generation | Done |
| Suggestion review (accept/reject/defer) | Done |
| Suggestion processing via LLM | Done |
| Auto commit message generation | Done |
| Save to GitHub | Done |
| Suggestion count badges | Done |
| Navigate from chat to suggestions | Done |

---

## Known Gaps vs Full Specification

### Missing: Persona-Based Context Loading
The spec defines personas (Consultant, Designer, Vibe Coder, etc.) with specific file load orders. Currently all files are shown equally with no role-based filtering.

### Missing: Auto-Generated Context Files
The spec requires auto-generation of:
- SCHEMA.md (data model)
- TYPES.md (TypeScript interfaces)
- API.md (function signatures)
- CODEBASE-MAP.md (project structure)
- CONVENTIONS.md (detected patterns)

Currently these must be created manually.

### Missing: Constraint Enforcement
The spec requires:
- Never contradict DECISIONS.md
- Flag if output touches OPEN-QUESTIONS.md
- Use exact terms from GLOSSARY.md only
- Role checks at data layer

Currently suggestions have no awareness of these constraints.

### Missing: Load Order Enforcement
The spec mandates:
1. COMPANY.md (always first)
2. AI-WORKFLOW.md (AI rules)
3. DECISIONS.md (architectural constraints)
4. Role-specific files

Currently files are loaded ad-hoc without hierarchy.

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `RESTACKED_API_KEY` | API key for Restacked LLM service |

GitHub credentials are stored client-side in localStorage (prototype only).

---

## File Structure

```
/vercel/share/v0-project/
├── app/
│   ├── api/
│   │   ├── chat/route.ts
│   │   ├── process-suggestions/route.ts
│   │   └── suggest/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── chat-view.tsx
│   ├── context-files-list.tsx
│   ├── file-viewer.tsx
│   ├── settings-panel.tsx
│   ├── simple-wysiwyg.tsx
│   ├── suggestions-panel.tsx
│   ├── theme-provider.tsx
│   └── ui/  (shadcn components)
├── contexts/
│   ├── github-context.tsx
│   └── suggestions-context.tsx
├── hooks/
│   ├── use-mobile.ts
│   └── use-toast.ts
├── lib/
│   ├── github-client.ts
│   ├── mock-suggestions.ts
│   └── utils.ts
└── public/
    └── logo.svg
```

---

## Conventions

- **State:** React Context for global state, useState for local
- **Data fetching:** Direct fetch in contexts, SWR not yet integrated
- **Styling:** Tailwind CSS v4 with design tokens in globals.css
- **Components:** shadcn/ui as base, custom compositions on top
- **API:** Next.js Route Handlers, streaming where applicable
- **Types:** TypeScript strict mode, interfaces over types

---

## Next Steps (Priority Order)

1. Implement persona selector with dynamic file loading
2. Add constraint checking against DECISIONS.md before saving suggestions
3. Add GLOSSARY.md term validation
4. Create auto-generation scripts for SCHEMA/TYPES/API/CODEBASE-MAP
5. Move GitHub credentials to secure server-side storage
6. Add OPEN-QUESTIONS.md conflict detection
