# DISCOVERY.md
## What this project is and why it exists

Restacked is a context orchestration platform for AI-assisted development teams. The core problem it solves: AI tools have no memory. Every session starts blank. Every team member re-explains the same context inconsistently. Outputs are generic, wrong, or contradict what was built last week.

Having context is not the solution. You can have too much, too little, or the wrong kind. The real problem is context orchestration -- knowing what context to bring into a prompt, when, from which source, and in what form. Restacked is the infrastructure that solves this: structured, versioned, automatically served context delivered to every AI tool every team member uses.

## Who are the users and who makes the purchase decision

This project has a unique characteristic: the team building Restacked is also the primary user of Restacked. We are building the system with the team, for the team. This means:

- User insights come from direct experience, not research
- Every pain point we solve is one we have personally hit
- The team validates the product by using it in their own daily work
- Context files for Restacked are produced by the same process Restacked is designed to support

The purchase decision model for external customers is still being defined. See OPEN-QUESTIONS.md. For persona definitions, see GLOSSARY.md.

## What the team looks like

The team covers all four roles required for AI-assisted development. For full role definitions, see ROLES.md.

## Pain points we are solving from direct experience

- Re-explaining the same project context in every AI session, across every tool
- AI generating code that contradicts decisions made last week
- Domain knowledge living in Slack threads and meeting notes, never reaching the model
- Experience Builder making backend architecture decisions inside frontend sessions
- No way to enforce workflow rules across the team without relying on discipline
- Switching AI tools means starting from zero -- no shared foundation
- Non-technical team members unable to contribute knowledge without touching GitHub
- Context drifting silently as the codebase evolves

## What success looks like

The team uses Restacked to build Restacked. Every AI session -- whether in Cursor, Lovable, Claude, or v0 -- starts with the right context already loaded. No manual re-explanation. No context drift. The prototype/production workflow is enforced by the system, not by discipline.

Externally: a consultant using Restacked delivers their second client in a vertical faster than the first. Their third faster than the second. Retainer replaces project billing.

## Reference tools and what we learn from them

**GitMCP** -- solves context delivery via MCP endpoints from GitHub repos. Proves the model works. Does not solve context generation, knowledge translation, or governance. Our delivery layer builds on this pattern.

**DecapCMS** -- inspiration for the CMS: GitHub as the store, clean UI for non-technical contributors without touching Git.

**Claude Projects** -- proves shared context improves team output consistency. Manual uploads required. Drift over time. We solve both.

**Cursor rules** -- confirms plain markdown files in a versioned store are the right primitive.

**Linear** -- reference for how developer tooling earns daily habit. Fast, opinionated, low friction.

## What we are not building (for now)

- A general-purpose LLM proxy
- A project management tool
- A code generation tool
- A replacement for Cursor, Lovable, Claude, or any AI tool the team already uses