# TASKS.md

Reusable task definitions. Each entry maps a user intent to a structured prompt.

Used by the CXM to enrich short prompts before they reach the AI.

---

## remove redundant context

Load: GLOSSARY.md, all context files in /context/

Task: Audit all context files for redundant content.

Redundancy means: the same information defined in more than one file.

Rules:

- GLOSSARY.md is the single source of truth for all defined terms and personas

- ROLES.md is the single source of truth for role definitions

- DECISIONS.md is the single source of truth for architectural decisions

- Other files must reference these, not redefine them

Output: For each redundancy found, state which file contains the duplicate, 

what the canonical source is, and produce the corrected file content.

Never delete canonical definitions -- only remove the duplicate.

---

## check context drift

Load: SCHEMA.md, TYPES.md, CODEBASE-MAP.md, DECISIONS.md

Task: Compare the current schema and codebase map against decisions and type 

definitions. Flag anywhere the code reality no longer matches the context files.

Output: A list of drift points with the file, the contradiction, and the fix needed.

---

## update after schema change

Load: SCHEMA.md, TYPES.md, API.md, CODEBASE-MAP.md

Task: A schema change has been made. Update all context files that reference 

affected tables, types, or API signatures. Do not change business logic or decisions.

Output: Updated versions of each affected file, ready to commit.