export interface Suggestion {
  id: string
  fileId: string
  type: "enhancement" | "addition" | "clarification"
  title: string
  description: string
  before?: string
  after: string
}

export type SuggestionStatus = "accepted" | "rejected" | "later"

const suggestions: Suggestion[] = [
  // BUSINESS-CONTEXT.md
  {
    id: "bc-1",
    fileId: "BUSINESS-CONTEXT.md",
    type: "enhancement",
    title: "Clarify target customer segment",
    description:
      "The target customer section uses broad language. Narrowing it to a specific ICP (Ideal Customer Profile) will make the context more actionable for product and sales decisions.",
    before: "Our target customers are businesses of all sizes looking to improve their productivity.",
    after:
      "Our primary ICP is mid-market B2B SaaS companies (50–500 employees) with dedicated product and engineering teams seeking to reduce context-switching overhead during development sprints.",
  },
  {
    id: "bc-2",
    fileId: "BUSINESS-CONTEXT.md",
    type: "addition",
    title: "Add competitive landscape section",
    description:
      "There is no competitive landscape section. Adding a brief overview of key competitors and differentiators helps align the team on positioning.",
    after:
      "## Competitive Landscape\n\n| Competitor | Strength | Our Differentiation |\n|---|---|---|\n| Notion | Flexibility | Developer-native workflow |\n| Confluence | Enterprise adoption | Lightweight and fast |\n| Linear | Issue tracking | Context-focused, not task-focused |",
  },
  {
    id: "bc-3",
    fileId: "BUSINESS-CONTEXT.md",
    type: "clarification",
    title: "Define success metrics",
    description:
      "The goals section lists qualitative outcomes but lacks measurable success criteria. Adding KPIs makes the objectives easier to evaluate.",
    before: "We want to help teams work better together and ship faster.",
    after:
      "Success is measured by: (1) reducing average context-gathering time per sprint by 40%, (2) achieving a 70% weekly active usage rate among connected teams, and (3) maintaining a NPS of ≥ 50 at the 6-month mark.",
  },
  {
    id: "bc-4",
    fileId: "BUSINESS-CONTEXT.md",
    type: "enhancement",
    title: "Strengthen value proposition statement",
    description:
      "The opening value proposition is generic. A sharper statement with a specific pain point and outcome will make this document more useful as a source of truth.",
    before: "We build tools that help software teams manage their work.",
    after:
      "We build a context-management layer for software teams — a single source of truth that keeps product decisions, technical constraints, and business goals in sync with the codebase.",
  },

  // TECH-STACK.md
  {
    id: "ts-1",
    fileId: "TECH-STACK.md",
    type: "enhancement",
    title: "Document rationale for each technology choice",
    description:
      "The tech stack is listed but lacks reasoning. Explaining why each tool was chosen prevents revisiting these decisions and helps new engineers onboard faster.",
    before: "- Next.js\n- PostgreSQL\n- Vercel",
    after:
      "- **Next.js** — Chosen for its hybrid rendering model (RSC + SSR), Vercel-native deployment, and ecosystem maturity. App Router enables fine-grained caching.\n- **PostgreSQL** — Relational model suits our structured data. Neon provides serverless scaling without cold-start penalties.\n- **Vercel** — Zero-config deployments, preview environments per PR, and edge network align with our shipping cadence.",
  },
  {
    id: "ts-2",
    fileId: "TECH-STACK.md",
    type: "addition",
    title: "Add architecture decision record for state management",
    description:
      "State management approach is not documented. Teams often revisit this decision; recording it here prevents redundant discussions.",
    after:
      "## State Management (ADR-003)\n\n**Decision:** SWR for server state, React Context for lightweight shared UI state.\n\n**Rationale:** We rejected Redux and Zustand as over-engineered for our current scale. SWR provides request deduplication, revalidation on focus, and optimistic updates out of the box. Context is reserved for auth state and theme only.\n\n**Revisit when:** Feature count exceeds 20 or team size exceeds 8 engineers.",
  },
  {
    id: "ts-3",
    fileId: "TECH-STACK.md",
    type: "clarification",
    title: "Specify deployment environment requirements",
    description:
      "The deployment section does not specify environment variable requirements or secrets management approach, which causes confusion during onboarding.",
    before: "Deploy to Vercel using the standard workflow.",
    after:
      "Deploy to Vercel via GitHub integration. Required environment variables: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. Secrets are managed in Vercel project settings — never commit `.env.local`. Preview branches use separate Neon branch databases automatically.",
  },
  {
    id: "ts-4",
    fileId: "TECH-STACK.md",
    type: "enhancement",
    title: "Add testing strategy section",
    description:
      "No testing approach is documented. Defining the testing pyramid early prevents inconsistent coverage and unclear ownership.",
    after:
      "## Testing Strategy\n\n- **Unit tests:** Vitest for pure functions and utilities (`/lib`, `/utils`)\n- **Component tests:** React Testing Library for UI components in isolation\n- **Integration tests:** Playwright for critical user flows (auth, file commit, suggestion acceptance)\n- **Coverage target:** 80% for `/lib`, 60% overall\n- **CI gate:** All tests must pass on PR; no merges to main with failing tests",
  },

  // README.md
  {
    id: "rm-1",
    fileId: "README.md",
    type: "enhancement",
    title: "Add quick-start section with prerequisites",
    description:
      "The README lacks a getting-started guide. New contributors need to know what to install and how to run the project locally.",
    before: "# Project\n\nThis is our project.",
    after:
      "# Context Manager\n\nA GitHub-integrated tool for managing AI-powered suggestions on your context files.\n\n## Quick Start\n\n```bash\n# Prerequisites: Node.js 18+, pnpm\npnpm install\npnpm dev\n```\n\nOpen [http://localhost:3000](http://localhost:3000) and connect your GitHub PAT to get started.",
  },
  {
    id: "rm-2",
    fileId: "README.md",
    type: "addition",
    title: "Add contributing guidelines",
    description:
      "There are no contributing guidelines, making it hard for new contributors to understand the expected workflow.",
    after:
      "## Contributing\n\n1. Fork the repository and create a feature branch: `git checkout -b feat/your-feature`\n2. Make your changes following the existing code style\n3. Write tests for new functionality\n4. Submit a pull request with a clear description\n\nAll PRs require at least one review before merging.",
  },
]

export function getSuggestionsForFile(fileName: string): Suggestion[] {
  return suggestions.filter((s) => s.fileId === fileName)
}

export function getAllMockFileNames(): string[] {
  return ["BUSINESS-CONTEXT.md", "TECH-STACK.md", "README.md"]
}
