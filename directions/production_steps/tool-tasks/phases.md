# Task manager app (TaskFoundry) — execution roadmap

**Product spec:** [overview.md](./overview.md) (full vision, MVP, tech stack, build phases, prompts).

**Purpose of this file:** Track major implementation steps for the full app capability as work lands in `3li`. Update checkboxes as phases complete.

---

## Baseline in this repo (snapshot)

- Prisma includes brainstorm models plus **TaskFoundry** models: `Workspace`, `Board`, `BoardList`, `Task`, `Label`, `Comment`, `ChecklistItem`, `Activity`, `TaskLabel`.
- Tasks are list-scoped with integer `order`; default board lists use `key` (`backlog` / `in_progress` / `done`).
- API: `/api/task-app/*` (bootstrap, boards, tasks, positions, labels, comments, checklist).

**Remaining gap vs full overview:** Auth/users, attachments, notifications delivery, realtime, automation engine, docs/goals modules (placeholders in app shell), AI task capture beyond brainstorm convert.

---

## Initiation — first moves (before / parallel to Phase 1 depth)

Use these to **start** the full capability without boiling the ocean:

- [x] **Architecture decision:** Confirm stack alignment with [overview §8](./overview.md) (Vite React client + API + PostgreSQL/Prisma already present; add Auth provider choice; realtime queue choice later).
- [x] **Schema migration plan:** Introduce core entities from [overview §10](./overview.md) incrementally — start with `User` (or auth-linked identity), `Workspace`, `Board`, `List`, `Task` with list-scoped ordering, then layer `Label`, `Comment`, etc.
- [x] **Ordering contract:** Define how list/card order is stored and updated for drag-and-drop (single source of truth for board + future table/calendar views).
- [x] **Route map vs IA:** Map [overview §9](./overview.md) nav to existing `/app/*` routes; add placeholders only where the shell does not exist yet.

---

## Phase 1 — Foundation ([overview §11 Phase 1](./overview.md))

- [x] Project/workspace/board/list/task CRUD APIs and Prisma models
- [ ] Auth wired to user ↔ workspace membership
- [x] Board page: horizontal lists, dnd-kit drag for cards and list reorder
- [x] Card detail modal/sheet (title, description, assignees, labels, due date, comments, subtasks, activity)
- [x] Responsive app shell consistent with design notes ([overview §14](./overview.md))

---

## Phase 2 — Usability (MVP-adjacent)

- [x] Search, filter, sort (board + global where spec’d)
- [x] My Tasks view
- [x] Table view (TanStack Table)
- [x] Calendar view (FullCalendar or equivalent)
- [x] Notifications center + activity timeline (workspace activity feed + `/app/notifications`)
- [x] Board templates (in-memory templates + create board from template per workspace)
- [x] Light/dark polish

---

## Phase 3 — Planning and scale

- [ ] Recurring tasks
- [ ] Timeline / Gantt view
- [ ] Task relations (blocks, depends on, etc.)
- [ ] Workload view
- [ ] Dashboard widgets

---

## Phase 4 — Automation and knowledge

- [ ] Rule builder + triggers/actions ([overview §5E](./overview.md))
- [ ] Forms intake
- [ ] Docs/wiki + task–doc linking
- [ ] Webhooks and integration stubs

---

## Phase 5 — AI

- [ ] NL capture, subtask suggestions, board summaries
- [ ] Planning assistant + smart prioritization (service boundaries first; see [overview Prompt F](./overview.md))

---

## MVP exit criteria (from overview §7 + §15)

Track explicitly for a “full MVP” milestone:

- [ ] User can create workspace, board, lists, cards; board UX feels strong
- [ ] Same tasks visible in **board**, **table**, and **calendar** views
- [ ] Data model does not block automation, docs, goals, AI later
- [ ] Demo-ready UI; architecture documented in-repo ([`directions/OVERVIEW.md`](../../OVERVIEW.md) or equivalent)

---

## Related repo docs

- [scaffold-checklist.md](../scaffold-checklist.md) — level-1 shell checks
- [local-dev.md](../local-dev.md) — how to run locally
