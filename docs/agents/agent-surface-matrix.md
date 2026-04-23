# Agent × surface matrix

Maps authenticated app routes (`/app/...`) to **which agents** should be available and **standard tools** (buttons, panels, sheets). Collapsible panels should follow the same expand/collapse affordance as Notes and Chat where applicable.

| Route | Primary purpose | Consultant | AI Consultant | Brand Rep | Red Team | Mailroom | Notebook linking | PM Agent | Standard tools (target UX) |
|-------|-----------------|-------------|---------------|-----------|----------|----------|------------------|----------|------------------------------|
| `/app/dashboard` | Home | — | — | — | — | entry | — | — | Link to Rapid Router, Brand Center |
| `/app/rapid-router` | Capture & route | — | — | optional review | **panel** | **primary** | — | optional | Red Team pre-route; Mailroom wizard; destination chips |
| `/app/notes` | Notebooks | — | — | — | **sheet/button** | **button → dialog** | inline refine | — | Mailroom (replaces brainstorm-only shortcut where applicable); Red Team exercises; export to Brainstorm |
| `/app/brainstorm` | Studio boards | — | **collapsible panel** | kit injection | **collapsible panel** | — | — | — | Mode + AI Consultant / Red Team tabs; convert plan → tasks |
| `/app/boards`, `/app/boards/:id` | Project boards | — | — | — | optional | optional | — | **sheet/popup** | “Plan with PM Agent”; send to notes/brainstorm with provenance (future) |
| `/app/tasks`, `/app/my-tasks` | Task lists | — | — | — | — | holding pen | — | **popup** | Create task → project space / board / holding pen |
| `/app/calendar` | Due dates & events | — | — | — | — | — | — | lens | Filters: people, project spaces, boards, keywords (future) |
| `/app/chat` | Consulting chat | **primary** | — | kit | — | — | — | — | Threads; consulting mode; RAG citations |
| `/app/brand-center` | Brand kit | optional | — | **primary** | — | — | — | — | Edit kit; preview prompt block |
| `/app/settings` | Brand & spaces | **context library** | — | — | — | — | — | — | Team + user context instructions (stored per brand/workspace) |

## Legend

- **primary**: Main value of the page for that agent.
- **panel / popup / button**: Expected entry control; see [prompt-starters.md](./prompt-starters.md) for copy.
- **kit injection**: Brand profile formatted into the LLM system message (not necessarily a visible Brand Rep “button”).

## Cross-cutting rules

1. **Brand kit** applies to any LLM call scoped to a workspace (via `workspaceId`).
2. **Team context** overrides **user context** on conflict ([context ladder](../vision/context-ladder.md)).
3. **Mailroom** should be reachable from Notes without forcing Brainstorm as the only outbound path ([copy alignment](../ux/copy-alignment-p0.md)).

## Implementation status (rolling)

| Route | What shipped in the shell |
|-------|---------------------------|
| Global | **Agents** dropdown in sidebar + mobile header; **Mailroom** dialog via [`MailroomRoutingContext`](../../client/src/context/MailroomRoutingContext.tsx) (single dialog in [`AppLayout`](../../client/src/components/layout/AppLayout.tsx)). |
| `/app/dashboard` | **Agent quick actions** card: Mailroom, Rapid Router, Consultant, Brand Center, Notebooks, Brainstorm ([`DashboardPage`](../../client/src/pages/DashboardPage.tsx)). |
| `/app/rapid-router` | **Red Team** panel ([`RedTeamPanel`](../../client/src/features/agents/RedTeamPanel.tsx)), Mailroom + Consultant links. |
| `/app/notes` | Mailroom button (global dialog), **Red Team** panel, **Linking ideas** (`notebookLinking` on [`POST /api/notes-app/notes/:id/ai`](../../server/src/routes/notesApp.ts)). |
| `/app/brainstorm` | Unchanged: AI Consultant + Red Team in [`BrainstormAIPanel`](../../client/src/features/brainstorm/components/BrainstormAIPanel.tsx). |
| `/app/boards`, `/app/boards/:id` | **PM Agent** sheet ([`PMAgentSheet`](../../client/src/features/agents/PMAgentSheet.tsx)) + [`POST /api/ai/agent`](../../server/src/routes/ai.ts) `surfaceType: task_popup`. |
| `/app/my-tasks`, `/app/tasks` | PM Agent sheet with filtered task snapshot. |
| `/app/calendar` | PM Agent sheet with due-dated task snapshot. **People / project filters** still depend on a future `User` / membership model ([data model review](../architecture/data-model-review.md)). |
| `/app/chat` | **Consultant Agent** title + link to Settings agent context ([`ChatPage`](../../client/src/pages/ChatPage.tsx)). |
| `/app/brand-center` | **Brand Rep** review block + [`brand_rep_review`](../../server/src/routes/ai.ts) on `/api/ai/agent`. |
| `/app/settings` | Agent context card (team + user instructions) unchanged. |
