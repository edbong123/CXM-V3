# OPEN-QUESTIONS.md
Unresolved decisions that will block progress if not answered. If your output touches any item here, stop and flag it — do not proceed with assumptions.

Each item has an owner and notes what it blocks.

---

## Purchase decision model: who buys Restacked?

The buyer persona is not yet defined. Is it the consultant buying for themselves? The dev team lead buying for their team? Both? Does the entry point change the product design?

Owner: Founding team
Blocks: GTM, pricing, onboarding flow design

---

## Product roles: are the initial definitions correct?

The five product roles in ROLES.md (Workspace Admin, Project Owner, Context Contributor, Developer, Viewer) are a Discovery phase draft. They need validation against real workflows before any auth implementation begins. Specifically: is a separate Viewer role needed in v1, or is read-only handled differently?

Owner: Domain Expert + Logic Builder
Blocks: Schema definition, auth implementation

---

## Persona 2 (Dev Team CEO): MVP target or post-MVP?

Multi-customer governance features (per-client model policies, audit trails, team usage analytics) are listed as MVP or post-MVP. If Persona 2 is an MVP target, several features move earlier. If post-MVP, the product can stay simpler for longer.

Owner: Founding team
Blocks: Feature prioritization, MVP scope

---

## CMS for context generation: what is the minimum viable version?

The CMS is listed as MVP Core and high value. What is the minimum version that unlocks knowledge-to-context translation for non-technical team members? Full editor with Claude-assisted drafting, or a simpler structured form per file type?

Owner: Experience Builder + Domain Expert
Blocks: Explore phase prototype scope

---

## Gateway (Level 4): what triggers the build?

The framework says to move to the gateway when context repos are large, call volume is high, or architectural rules are being violated. When do we expect to hit these triggers for Restacked's own build? Is there a specific milestone that triggers the Level 4 sprint?

Owner: Logic Builder
Blocks: Infrastructure planning, Level 4 sprint timing

---

## Visual identity and design system: in scope for V2?

The Design Director role is defined but no person is assigned. Is visual identity work happening in parallel with the V2 build, or deferred? Does the Experience Builder proceed without a design system, or is a minimal design system required before prototyping begins?

Owner: Founding team
Blocks: Experience Builder start conditions for V2
