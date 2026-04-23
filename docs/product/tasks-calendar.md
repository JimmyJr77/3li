# PRD: Task lists and calendar

## Task lists

### Problem

Users need a consolidated view of **outstanding work**, ownership, and filters—plus ability to create tasks that land on a board, a workspace backlog, or a **holding** area for manual triage.

### Goals

- Filter by assignee, workspace, board, status, keyword.
- Create task with optional **project space** and **board**; allow “unfiled” into a triage list per workspace.
- New project space created here should **propagate** to the rest of the app (single `Workspace` record—ensure list refresh).

### Open questions

- Single global “rapid routing holding pen” list vs per-workspace columns.
- Assignee requires user directory (see data model review).

## Calendar

### Problem

Users need to see **due dates** and **events** in one place with flexible views.

### Goals

- **Views**: month/week/list; **sort** by date; **filter** by people, project spaces, boards, keywords.
- Pull from **task due dates** at minimum; **events** may need a new model or integration.

### Current implementation

- `Task.dueDate`, `Task.startDate` exist in Prisma.

### Open questions

- Dedicated **CalendarEvent** table vs external calendar sync.
- “People” filter depends on multi-user identity.

### Acceptance criteria

- List view shows same tasks as board for a given filter set (consistent query layer).
