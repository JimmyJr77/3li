# Brainstorm Studio — execution roadmap

Product brief: [overview](./overview) (full narrative spec).

Canonical implementation spec path used in-repo: this folder plus [data-model-notes.md](./data-model-notes.md). Optional alias path: [`docs/brainstorm-studio-spec.md`](../../../docs/brainstorm-studio-spec.md).

## Phase 1 — Canvas + nodes

- [x] `@xyflow/react` canvas on `/app/brainstorm`
- [x] Custom idea nodes (title, description, tags, status, priority)
- [x] Edges for relationships
- [x] Zustand store for canvas state

## Phase 2 — AI co-pilot + thinking modes

- [x] Right panel with actions (expand, critique, alternatives, convert to plan)
- [x] Top bar thinking modes (Divergent, Convergent, Strategic, Execution) affecting UI + API
- [x] `POST /api/ai/brainstorm` with mode-specific system prompts

## Phase 3 — Persistence

- [x] Prisma models: Project, BrainstormSession, IdeaNode, IdeaEdge; Task extended for board linkage
- [x] REST API for default session load + canvas save
- [x] TanStack Query load/save (debounced) on Brainstorm page

## Phase 4 — Execution layer

- [x] Convert-to-plan creates `Task` rows linked to source idea node
- [x] Tasks page lists tasks with idea linkage
- [x] Board page Kanban (columns: Backlog / In Progress / Done) backed by API

## Phase 5 — Prompt library + save UX (overview Part 3 §10 + session save feedback)

- [x] **Prompt library** — Pre-built prompts: Break this idea, Find weaknesses, Monetize this, Turn into MVP (`promptLibrary.ts` + AI panel section)
- [x] **Quick actions** — Kept as a separate row from the library for fast access
- [x] **Autosave status** — Toolbar shows Unsaved → Saving → Saved (or error) around debounced canvas sync

## Phase 6 — Multiple sessions (overview Part 3 §7 Sessions + sidebar IA)

- [x] **API** — `GET/POST/PATCH/DELETE /api/brainstorm/sessions`, `GET /api/brainstorm/sessions/:id`, `PUT .../sessions/:id/canvas`, `POST .../sessions/:id/convert-plan` (legacy `/session` paths kept)
- [x] **URL state** — `?session=<id>` on `/app/brainstorm`; list loads default project sessions
- [x] **Session bar** — Switch session, new session, rename title, delete when more than one session

## Later (overview Part 7 — not scheduled)

- [ ] Realtime collaboration / live cursors
- [ ] Full knowledge graph view (Obsidian-style)
- [ ] Voice → nodes, AI auto-clustering, scoring, pitch deck builder
- [ ] Optional Supabase/Firebase realtime if multi-user editing becomes a requirement
