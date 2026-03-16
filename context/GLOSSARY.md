# GLOSSARY.md
Use these terms exactly. Do not substitute synonyms. If a term is not here, add it before using it in context files or generated content.

---

## Core concepts

**Context**
Structured information about a project, codebase, domain, or team loaded into an AI tool's prompt to improve output quality. Context is not documentation someone wrote. It is knowledge translated into a form AI tools can consume.

**Context orchestration**
The practice of knowing what context to bring into a prompt, when, from which source, and in what form. Having context is not enough — the right context must reach the right tool at the right moment.

**Context drift**
The state where context files no longer accurately reflect the codebase, schema, or decisions they describe. Causes AI tools to generate code that contradicts reality.

**Knowledge-to-context translation**
The process of taking knowledge produced by a team (in meetings, Slack, decisions, conversations) and converting it into structured context files that AI tools can consume. Requires human judgment. Cannot be fully automated.

**Home base**
The primary backend of a project. The source of truth from which technical context (schema, types, API signatures, role model) is generated automatically.

**Context tier**
One of three levels of context: company (what every project needs), domain (specialized vertical knowledge reused across projects), and project (what this specific build needs).

**MCP (Model Context Protocol)**
A protocol that allows AI tools to fetch context from external sources at runtime. Enables live context delivery without manual uploads.

**MCP endpoint**
A URL that exposes a GitHub repository as a live context source. Any MCP-compatible tool connects once and reads current context automatically.

---

## Development workflow

**Prototype mode**
The phase where the Experience Builder experiments freely using vibe coding tools. Iterates fast. Prototype code is never deployed to production. Its value is the validated logic and workflow decisions it encodes — a specification written in code.

**Production rewrite**
The step where the Logic Builder takes validated prototype logic and rewrites it cleanly into the production codebase. Never a deployment of prototype code. Always a clean rewrite from a validated specification.

**Vibe coding**
AI-assisted development using tools like Lovable, v0, or Cursor with high AI generation involvement. Fast iteration, low boilerplate. Output quality is directly proportional to context quality.

**Vibe coding consultant**
A solo practitioner or micro-team using AI-assisted tools to build custom B2B software for SMB clients. Primary target persona for Restacked.

**AI harness**
A layer that provides tools, context, rules, security, and governance on top of any LLM. Routes to the right model, injects context, enforces workflow rules. Restacked's gateway is a cloud-based AI harness.

**ChatML endpoint**
A named, versioned AI endpoint pre-configured with a system prompt, knowledge base, model, and context scope. Called with a single API call. Updates propagate immediately to all consuming clients.

---

## Auto-generated context files

**SCHEMA.md**
Auto-generated from the home base. Describes the data model. Regenerated on every meaningful schema change.

**TYPES.md**
Auto-generated TypeScript interfaces from the home base.

**API.md**
Auto-generated function signatures from the home base.

**CODEBASE-MAP.md**
Auto-generated file describing what exists in the codebase: module structure, what each module does, where it lives. Critical during production rewrites.

**CONVENTIONS.md**
Auto-generated file describing detected patterns in the codebase: naming conventions, component structure, code style. Prevents new code from contradicting existing patterns.

---

## Personas

**Persona 1 — Vibe Coding Consultant**
Solo or micro-team building B2B platforms for SMB clients using AI-assisted tools. Wants a repeatable platform delivery system where each new client in a vertical is faster than the last.

**Persona 2 — Dev Team CEO**
Runs an agency or dev shop. Wants delivery capability as company infrastructure, not locked in individual developers.

**Persona 3 — Platform Owner CEO**
SMB leader running their business on a platform built by Persona 1 or 2. Not technical. Wants operational ownership without calling the consultant.
