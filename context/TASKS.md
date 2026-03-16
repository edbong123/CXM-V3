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

## sync llms.txt

Load: all files in /context/

Task: Audit llms.txt against all context files that exist in the repo.

Rules:

- Every file in /context/ must be reachable from llms.txt

- Files must be placed in the correct section based on their purpose:

  - Always load first: DECISIONS, PROJECT, ROLES

  - Load for code tasks: GLOSSARY, OPEN-QUESTIONS

  - Load for discovery and planning: DISCOVERY

  - Load for task execution: TASKS

  - Generated from PURPOSE.md: PURPOSE, v0-instructions, cursor-rules, claude-instructions

  - Load when available (auto-generated): SCHEMA, TYPES, API, CODEBASE-MAP, CONVENTIONS

- If a file exists in /context/ but is missing from llms.txt, add it to the correct section

- If a file is listed in llms.txt but does not exist in /context/, mark it as not yet active

- If a file description in llms.txt no longer matches what the file actually contains, update the description

- Never remove a file from llms.txt -- mark it as not yet active instead

- Do not change the Rules section unless a rule in DECISIONS.md has changed

Output: Updated llms.txt ready to copy and paste. List what changed and why.
