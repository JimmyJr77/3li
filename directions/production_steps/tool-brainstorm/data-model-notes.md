# Brainstorm Studio — data model & API

## Prisma entities

| Model | Purpose |
|-------|---------|
| `Project` | Top-level bucket; default “Workspace” project seeds with the app |
| `BrainstormSession` | One canvas per session; belongs to a project |
| `IdeaNode` | Idea card on the canvas; stores React Flow position + structured fields |
| `IdeaEdge` | Connection between two idea nodes (`sourceId` → `targetId`) |
| `Workspace` / `Board` / `BoardList` | TaskFoundry shell: default workspace + “Main board” + lists with `key` `backlog` / `in_progress` / `done` |
| `Task` | Belongs to a `BoardList` (`listId`); optional `ideaNodeId` when created from “convert to plan”. List **key** (`backlog` / `in_progress` / `done`) drives Kanban columns |

## React Flow mapping

- Node `id` in the client === `IdeaNode.id` (string, cuid).
- Edge `id` === `IdeaEdge.id`.
- Custom node type key: `idea`.

## HTTP surface (Express)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/brainstorm/sessions` | List sessions for the default project (`nodeCount` per row) |
| `POST` | `/api/brainstorm/sessions` | Create empty session (`{ title? }`) |
| `GET` | `/api/brainstorm/sessions/:id` | Full canvas payload (same shape as legacy session GET) |
| `PATCH` | `/api/brainstorm/sessions/:id` | Rename session (`{ title }`) |
| `DELETE` | `/api/brainstorm/sessions/:id` | Delete session (400 if it is the only one) |
| `PUT` | `/api/brainstorm/sessions/:id/canvas` | Replace canvas nodes/edges |
| `POST` | `/api/brainstorm/sessions/:id/convert-plan` | Same as legacy convert-plan |
| `GET` | `/api/brainstorm/session` | **Legacy:** first/default session + canvas |
| `PUT` | `/api/brainstorm/session/:id/canvas` | **Legacy:** same as `PUT .../sessions/:id/canvas` |
| `POST` | `/api/brainstorm/session/:id/convert-plan` | **Legacy:** same as sessions convert |
| `GET` | `/api/task-app/tasks` | Flat task list (optional `workspaceId`); includes `list` for board/column context |
| `PATCH` | `/api/task-app/tasks/:taskId` | Update task fields, including `listId` to move columns |

Task CRUD and board UI use **`/api/task-app/*`** (shared with the Kanban app). Brainstorm convert-plan uses the same default workspace/board as `ensureDefaultWorkspaceBoard()` in [`server/src/lib/taskDefaults.ts`](../../../server/src/lib/taskDefaults.ts).

## AI

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ai/brainstorm` | `{ prompt, mode, context? }` — mode-specific system prompt |
| `POST` | `/api/ai/chat` | Legacy single `{ prompt }` chat |

Update this file when the schema or routes evolve.
