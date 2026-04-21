# Consulting Intelligence / tool-chat — execution roadmap

**Product spec:** [overview.md](./overview.md) (market landscape, core synthesis, architecture sketch, optional `CONSULTING_CHAT_APP_SPEC.md` prompt block).

**Purpose of this file:** Track major implementation steps toward the full “Consulting Intelligence Platform” capability as work lands in `3li`. Update checkboxes as phases complete.

---

## Baseline in this repo (snapshot)

- **Route:** `/app/chat` — **implemented** (threads, streaming, three-panel layout, RAG, uploads, task links).
- **API:** `POST /api/ai/chat` (non-stream, shared turn prep) and `POST /api/chat/stream` (SSE); `GET /api/chat/*` for bootstrap, threads, documents, search, templates.
- **Patterns:** Consulting modes + RAG reuse brainstorm-style server-side orchestration (`prepareConsultingTurn`).
- **Data:** `ChatThread`, `ChatMessage`, `ChatDocument`, `DocumentChunk`; `Task` has optional `chatThreadId` / `sourceMessageId`.

**Gap vs [overview](./overview.md):** Collaboration / multi-user auth, native desktop folder picker, and deeper financial modeling wizards remain future work.

---

## Initiation — first moves (before deep RAG)

- [x] **North-star slice:** MVP = streaming chat + modes + project/workspace context first; RAG + citations second — **both shipped** in one pass.
- [x] **Identity & scope:** Threads use **`Project`** (brainstorm project) + optional **`Workspace`** for default task board; no duplicate hierarchy.
- [x] **Chat persistence:** `ChatThread` + `ChatMessage` (role, content, citations JSON).
- [x] **API contract:** `/api/chat/stream` (SSE meta/token/done), legacy `/api/ai/chat` returns JSON with `threadId`, `citations`.
- [x] **Consulting modes:** `strategy` | `financial` | `operations` | `technical` with prompt mapping.
- [x] **Vector strategy:** `text-embedding-3-small` embeddings stored as **JSON** arrays on `DocumentChunk`; cosine similarity in app (no pgvector required for MVP).

---

## Phase 1 — Chat foundation (usable “app”)

- [x] **Chat UI:** Thread list, project + workspace selectors, message list, composer, templates row.
- [x] **Streaming:** SSE end-to-end; **Stop** aborts fetch.
- [x] **Mode selector:** Per-request / thread; persisted on thread when updated from server.
- [x] **Project context:** `projectId` + optional `workspaceId` passed through turn prep.

---

## Phase 2 — Knowledge + RAG (MVP credibility)

- [x] **Document model:** `ChatDocument` linked to `projectId`, optional `threadId`, metadata + `extractedText` cap.
- [x] **Upload pipeline:** PDF / DOCX / TXT / MD → extract → chunk → embed → store.
- [x] **Semantic search:** `POST /api/chat/search` (optional; chat turn also retrieves top-k).
- [x] **RAG in chat:** Injected into system prompt; citations stored on assistant messages; UI shows source list.
- [x] **Local folder ingestion (server):** `POST /api/chat/documents/ingest-local` when `ALLOW_LOCAL_PATH_INGEST=true` and `LOCAL_INGEST_ROOT` are set — scans PDF/DOCX/TXT/MD under a path **relative to that root**. Not a browser folder picker.

---

## Phase 3 — Execution layer integration

- [x] **Tasks from chat:** `POST /api/task-app/boards/:boardId/tasks` accepts `chatThreadId` (and `sourceMessageId`); chat UI adds tasks to default board backlog.
- [x] **Right rail:** Documents, last retrieval, linked tasks for `chatThreadId`.
- [x] **Structured outputs:** `GET /api/chat/templates` + quick-fill buttons (exec summary, issue tree, roadmap).

---

## Phase 4 — Advanced (overview “Phase 2” items)

- [x] **Slide / deck export** — `POST /api/chat/export/pptx` (pptxgenjs); **Export PPTX** uses latest assistant reply. Title slide + one slide per paragraph (`##` optional heading).
- [ ] **Collaboration, permissions, multi-user** — not implemented.
- [x] **Guided flows** — `GET /api/chat/flows` + MECE / hypothesis / financial lens step buttons (composer prompts). Deeper interactive wizards still optional.

---

## Definition of done (full capability — rolling)

The **core product loop** is live: multi-thread chat, modes, RAG with citations, uploads, project scope, task linkage, three-panel workspace. Remaining items are **scale, collaboration, and export** depth from the overview.
