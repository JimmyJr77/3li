# PRD: Project boards

## Problem

Teams need shared **task management** with clear ownership and the ability to push work to **notes** or **brainstorm** for refinement while preserving **provenance**.

## Goals

- **Multi-user collaboration** (same board, concurrent edits) — align with roadmap; current schema may lack assignees/users (see data model review).
- **Project Manager Agent** popup: planning session from goals; future: ingest meeting notes to update tickets.
- Sending a ticket to brainstorm or notes **tags origin** so returned content attaches to the right artifact.

## Current implementation (reference)

- `Board` → `BoardList` → `Task` under `Workspace`.
- `Task` has `ideaNodeId`, `chatThreadId`, comments, labels.

## Open questions

- **Assignee** model: user ids vs free-text.
- **Provenance** field: `Task.metadata` JSON vs dedicated columns (`sourceType`, `sourceId`).
- Real-time transport (WebSocket) vs optimistic polling.

## Agents

- **Project Manager Agent** (`project-manager-agent.md`).
- **Mail Clerk** for cross-routing when splitting work.

## Acceptance criteria

- Export to notes includes back-link or stable reference id in body or metadata.
