# CONTEXT_BUNDLE specification

Machine- and human-readable contract for **what goes into each LLM call**. Pair with [context-bundle.schema.json](./context-bundle.schema.json).

## Purpose

- Unify chat, notes AI, brainstorm, routing, and future agent endpoints.
- Version context shapes independently of UI.
- Enforce **precedence**: team → user → brand → workspace → RAG → surface.

## Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | string | yes | Semver for this bundle shape (e.g. `1.0.0`). |
| `requestId` | string | no | Correlation id for logs. |
| `workspaceId` | string \| null | no | Active TaskFoundry workspace (`Workspace.id`). |
| `projectId` | string | no | Brainstorm/RAG `Project.id` when applicable. |
| `threadId` | string \| null | no | `ChatThread.id` when in a chat turn. |
| `agentId` | string | yes | One of: `consultant`, `ai_consultant`, `brand_rep`, `red_team`, `mail_clerk`, `notebook_linking`, `project_manager`. |
| `surfaceType` | string | yes | `chat`, `notes_refine`, `brainstorm`, `rapid_router`, `task_popup`, `calendar`, etc. |
| `consultingMode` | string | no | For chat: `strategy` \| `financial` \| `operations` \| `technical`. |
| `thinkingMode` | string | no | For brainstorm: divergent / convergent / strategic / execution. |
| `teamContextRefs` | array | no | List of document or blob ids resolved server-side to **team** text. |
| `userContextRefs` | array | no | Resolved **user** context for this principal + workspace. |
| `brandProfileRef` | object | no | Usually implicit via `workspaceId` + DB `brandProfile`; include when passing a draft. |
| `brandSupplement` | string | no | Client “quick capture” text; cap ~8k chars; merged after DB kit. |
| `rag` | object | no | `{ enabled: boolean, topK?: number }` — actual chunks appended by server. |
| `surfacePayload` | object | yes | Surface-specific body (message text, note content, nodes, tasks). |

## `surfacePayload` shapes (examples)

### `chat`

```json
{
  "message": "User message text",
  "historyTruncated": false
}
```

### `notes_refine`

```json
{
  "noteId": "…",
  "title": "…",
  "contentExcerpt": "…"
}
```

### `brainstorm`

```json
{
  "sessionId": "…",
  "selectedNodeIds": ["…"],
  "canvasSummary": "optional text summary"
}
```

### `rapid_router`

```json
{
  "captureText": "…",
  "stickyIds": [],
  "suggestedDestinations": ["notebooks", "brainstorm", "board"]
}
```

## Token budgets (guidance)

| Block | Soft max (chars, order-of-magnitude) | Notes |
|-------|--------------------------------------|--------|
| Team context | 12k | Highest priority; do not truncate without UX warning. |
| User context | 8k | |
| Brand kit (formatted) | 14k | Align with `formatBrandProfileForPrompt` cap behavior. |
| Brand supplement | 8k | Matches current `prepareTurn` trim. |
| RAG | ~8 chunks × ~900 chars | As in `prepareTurn` excerpt length. |
| Surface | Remainder | User message + structured attachment. |

Adjust per model context window; keep **total system + user** within model limits.

## Versioning

- Bump **`schemaVersion`** when adding required fields or changing precedence semantics.
- Bump **`brandProfile` Zod/schema** in server when the JSON kit shape changes; document in changelog.

## Security

- Resolve `teamContextRefs` and `userContextRefs` only after **authorization** checks (user may read this workspace and these documents).
- Never pass cross-tenant content into a bundle.
