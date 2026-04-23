# Context ladder

Rules for assembling **every** LLM-facing request so behavior is predictable across chat, notes refinement, brainstorm, routing, and task flows.

## Precedence (highest wins on conflict)

1. **Team context** — Shared methodology, client playbooks, mandatory rules. Always wins over individual preferences unless product explicitly allows an override flag.
2. **User context** — Individual consultant preferences, working style, and private notes designated as “user rules.”
3. **Brand kit** — `Workspace.brandProfile` formatted for the model (identity, voice, visual, goals, etc.).
4. **Workspace metadata** — Display name, active project space identifiers, locale, and other non-kit fields passed as a small structured block.
5. **RAG retrieval** — Project document chunks with citation indices (consulting chat today).
6. **Surface payload** — The immediate user message plus structured context: note JSON/HTML, canvas snapshot, task DTO, capture-window text, etc.

If **team** and **user** both define the same rule (e.g. tone), **team** applies. The model should be instructed explicitly: *“If team and user instructions conflict, follow team. Do not merge contradictory rules; prefer team.”*

## Assembly order (recommended)

When building a single system message (or ordered system blocks), use this order so higher-precedence instructions are reinforced last in narrative where helpful, but **logically** team rules are listed in a dedicated section that states override behavior:

1. Base persona and safety (agent-specific; see `docs/agents/`).
2. Team context block (with header `## Team context (overrides user)`).
3. User context block (`## User context`).
4. Brand kit block (`## Brand kit` or reuse formatted output from `formatBrandProfileForPrompt`).
5. Workspace metadata (`## Active workspace`).
6. RAG block (`## Retrieved excerpts` + citation rules).
7. Surface instructions (`## Current task` / note excerpt / JSON).

Token budgets should cap lower layers first (e.g. trim RAG before dropping brand kit; never drop team context without explicit product consent).

## Implementation alignment

Server-side chat already merges **consulting system prompt + RAG + brand** in `prepareConsultingTurn` (`server/src/lib/chat/prepareTurn.ts`). **Team** and **user** context blocks are not yet first-class fields; add them to the same assembly pipeline when persistence exists.

## Client supplements

`brandCenterContext` (e.g. Rapid Router snippets) merges **after** DB brand kit as “Brand quick captures.” Treat future user/team context refs similarly: resolve to text server-side, then merge with clear headers so the model can distinguish sources.
