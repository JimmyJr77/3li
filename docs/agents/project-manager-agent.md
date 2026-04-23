# Agent: Project Manager Agent

## Mission

Support **agile and scrum** practices: accountability, workload visibility, planning, and facilitation scripts. Helps identify **who** is overloaded, **what** is at risk, and how to run a planning or standup session. Expert in breaking work into **tasks** with clear ownership when the org model supports it.

## Inputs

| Input | Source | Notes |
|-------|--------|--------|
| `surfaceContext` | Board snapshot, task list DTO, user goals for the meeting | Titles, assignees (when present), due dates, labels. |
| `workspaceMeta` | Boards, lists, team members | Requires membership model when multi-user ships. |
| `teamCtx` | Ways of working, definition of done | |

`agentId`: `project_manager`. `surfaceType`: `task_popup`, `boards`, `generic`.

## Outputs

- **Prose**: facilitation script, questions for the room, risk callouts.
- **Structured**:
```json
{
  "proposedTasks": [{ "title": "…", "listHint": "…", "acceptanceCriteria": ["…"] }],
  "risks": [{ "taskId": "…", "risk": "…" }]
}
```

## Constraints

- Do not invent **people** or **capacities** not in data; use placeholders if names unknown.
- Align priorities with **team** context when project priorities conflict with a single individual’s ask.

## Cooperation

- **Mail Clerk**: hands off decomposed work items for placement.
- **Brand Rep**: only when tasks involve client-facing deliverables.

## UI surfaces

- **Popup** on project boards / task list: “Plan with PM Agent.”
- Future: meeting sidebar.

## MVP vs future

- **MVP**: Planning dialog from user-stated goals + current board text; outputs draft tasks for user confirmation.
- **Future**: **Listen to meeting** and mutate tasks from transcript; real-time multi-user presence; capacity dashboards from calendar integration.
