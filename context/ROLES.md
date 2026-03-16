# ROLES.md
This file has two sections: team roles and product roles. These are different things. Always check which section is relevant to the task.

---

## Section 1: Team Roles

Who builds the system and what each person is responsible for. One person may hold multiple roles.

**Logic Builder**
Owns the hard technical problems: data models, business logic, auth, infrastructure. Defines the schema, TypeScript interfaces, and role model that every other role builds against. Owns the production rewrite step — takes validated prototype logic and rewrites it cleanly into production. Never deploys prototype code. AI amplifies output; cannot replace judgment on tradeoffs.

**Experience Builder**
Builds everything users see using vibe coding tools. Works in prototype mode only. Iterates fast. Output quality is directly proportional to context quality. Never makes backend architecture decisions — that is always the Logic Builder's responsibility.

**Domain Expert**
The human source of truth for how AI-assisted development actually works. In this project the domain is context orchestration itself. Their knowledge of real workflows, failure modes, and team dynamics is the core asset. Must be encoded into context files — cannot stay in conversations or Slack.

**Context Maintainer**
Owns context quality across all tiers. Specifically responsible for knowledge-to-context translation: taking all definitions, decisions, domain knowledge, and artifacts produced by the team and translating them into structured context files. Without this role actively doing this, all knowledge produced by the team never reaches the AI. It is never nobody's job.

---

## Section 2: Product Roles

Who uses the Restacked product and what they can do. These are the roles inside the platform — not the team building it.

Note: these definitions are a starting point from the Discovery phase. Validate before implementing auth.

**Workspace Admin**
Full access to all projects, team members, context repositories, and billing. Manages the org configuration. Creates projects, assigns team members, manages integrations. Can grant and revoke access for all other roles.

**Project Owner**
Manages a specific project: context repositories, team access, home base connection, MCP endpoint configuration. Can invite contributors to their project. Cannot access other projects unless explicitly granted.

**Context Contributor**
Creates and edits context files via the CMS. Commits to GitHub through the Restacked interface without needing direct GitHub access. Typical holders: Domain Expert, Context Maintainer.

**Developer**
Connects AI development tools via MCP. Reads context. Does not edit context directly — uses the CMS or PR workflow. Typical holders: Logic Builder, Experience Builder.

**Viewer**
Read-only access to project context and status. Cannot edit or commit. Typical holders: client stakeholder, contractor with limited access.

---

## What each product role must never be able to do

- Context Contributor must never modify project access settings or billing
- Developer must never modify another project's context without explicit access grant
- Viewer must never commit, publish, or modify any content
- No role except Workspace Admin can add or remove team members from the workspace
- No role except Project Owner or Admin can modify project-level integrations
