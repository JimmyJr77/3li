# Notebooks — execution roadmap

**Product spec:** [overview.md](./overview.md) (Notebooks: capture, editor, folders, tags, search, backlinks, templates, AI, publishing).

**Implementation stack (this repo):** Vite + React Router + Express + Prisma/Postgres — **not** Next.js. The overview’s Next.js/Vercel wording is conceptual; details here override for `3li`.

**Purpose:** Track major steps for `/app/notes` as a **first-class notes domain** (not TaskFoundry/kanban). Update checkboxes as work lands.

---

## Baseline (snapshot)

- **Route:** `/app/notes` → Notebooks shell with folders, note list, TipTap editor, autosave to `/api/notes-app`.
- **Data:** `Note`, `NotesFolder`, `NoteTag`, `NoteLink` scoped to existing `Workspace` ([prisma/schema.prisma](../../../prisma/schema.prisma)).
- **Removed:** Prior placeholder-only `NotesPage` and empty `features/notes` stub — replaced by Notebooks implementation.

---

## Erase / replace checklist (completed at initiation)

- [x] Replace placeholder [NotesPage.tsx](../../../client/src/pages/NotesPage.tsx) with Notebooks layout.
- [x] Replace stub [features/notes/index.ts](../../../client/src/features/notes/index.ts) with real module exports.
- [x] Remove BoardNotes/Task-centric planning; this file now tracks Notebooks only.

---

## Phase 1 — Foundation

- [x] Prisma models + migration for notes (folders, notes, tags, optional links).
- [x] `GET/POST/PATCH/DELETE` notes + folders; bootstrap endpoint for default workspace.
- [x] Auth: same as rest of app (open API until auth is wired globally).

---

## Phase 2 — Notes engine

- [x] TipTap editor + `contentJson` persistence + debounced autosave.
- [x] Folder tree + note list UI on `/app/notes`.
- [x] Tag UI — workspace tag pills + “New tag” field; toggles `tagIds` via `PATCH`.
- [x] Quick capture — `QuickCaptureSheet` (button + ⌘⇧C / Ctrl⇧C); multi-line plain text → TipTap doc on create.

---

## Phase 3 — Knowledge

- [x] `[[wikilinks]]` — type in editor; server parses TipTap JSON on save and syncs `NoteLink` rows (match target note **title** in workspace, case-insensitive).
- [x] Outgoing + backlinks panels in note detail (`GET .../forward-links`, `.../backlinks`).
- [x] Search API (`GET /api/notes-app/search`) + search box on `/app/notes`.
- [x] Keyboard shortcut for quick capture (⌘⇧C / Ctrl⇧C) on `/app/notes`.
- [x] Global command palette (`Cmd+K`) with notes search, quick actions, and built-in templates (`NotesCommandPalette`).

---

## Phase 4 — AI + publishing

- [x] OpenAI routes: `POST /api/notes-app/notes/:id/ai` with `summarize`, `rewrite`, `suggestTags` (uses `OPENAI_API_KEY` like `/api/ai`).
- [x] Public note: `isPublic` + `publicSlug` (normalized on save), `GET /api/notes-app/public/:slug`, Vite route `/n/:publicSlug` read-only page with TipTap HTML render.

---

## Phase 5 — Advanced

- [x] **Templates** — built-in starters (daily journal, meeting, project brief) in `noteTemplates.ts`; create from command palette or browse actions when palette opens.
- [x] **Import / export** — JSON export for current note or full workspace list; import recreates notes (new IDs). See `notesImportExport.ts` + `NotesPortabilityPanel`.
- [x] **Collaboration (MVP)** — in-app link with `?note=` for deep-linking; copy link in portability panel; publish remains read-only sharing. Real-time co-editing is not in scope yet.

---

## Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| — | Notes domain is **standalone** (`Note` / `NotesFolder`), not `Task` | Matches Notebooks overview; TaskFoundry stays separate. |
| — | TipTap document stored as `contentJson` on `Note` | Simpler than normalized blocks for MVP. |

---

## Risks

- **Large JSON blobs:** Mitigate with `previewText` and lazy full fetch later if needed.
- **Publishing/SEO:** In-app public link first; SSR later if required.
