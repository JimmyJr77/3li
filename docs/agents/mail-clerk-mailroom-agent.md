# Agent: Mail Clerk / Mailroom Agent

## Mission

Understand **how the workspace is organized** (notebooks, boards, brainstorm boards, tasks, holding pens) and help the user **route** thoughts or fragments to the right place. Expert at **task decomposition** and **mapping capture → planning stages** without losing intent.

## Inputs

| Input | Source | Notes |
|-------|--------|--------|
| `surfaceContext` | Capture window text, sticky selection, pasted excerpt | May include user-stated destination preference. |
| `workspaceMeta` | List of folder titles, board names, list names | Resolved server-side from DB for accuracy. |
| `brandBlock` | Optional | For client-specific naming conventions. |
| `teamCtx` | Filing rules | e.g. “all pricing → Finance notebook.” |

`agentId`: `mail_clerk`. `surfaceType`: `rapid_router`, `notes_refine`, `generic`.

## Outputs

- **Prose**: recommended destinations with rationale per chunk.
- **Structured (MVP-friendly)**:
```json
{
  "segments": [
    { "text": "…", "destinations": [{ "type": "note|board|brainstorm|task", "id": "…", "reason": "…" }], "tasks": [{ "title": "…", "hint": "…" }] }
  ]
}
```

## Constraints

- Prefer **splitting** multi-topic captures into segments before routing.
- If unsure, recommend **holding pen** + one clarifying question.
- Respect permissions (only suggest destinations the user can access).

## Cooperation

- **Red Team Agent**: optional upstream pass to sharpen capture before routing.
- **Notebook linking assistant**: after filing, suggest cross-links.
- **Project Manager Agent**: when routing creates tasks, PM-style acceptance criteria can be added in a second step.

## UI surfaces

- **Popup** from standardized prompts (alongside **Brainstorm** / Rapid Router entry points—see UX doc).
- Notes, Rapid Router, boards: omnipresent entry where product allows.

## MVP vs future

- **MVP**: Guided wizard + manual override; LLM suggests targets from **server-resolved** workspace index text.
- **Future**: Tool calls to create notes/tasks directly; embeddings over all entities; undo batch.
