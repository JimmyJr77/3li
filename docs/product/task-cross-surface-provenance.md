# PRD: Task provenance across surfaces

**Phase tags:** P2 schema → P1/P2 UX (badges + filters).

## Problem

When work moves between **project boards**, **brainstorm**, **notes**, and **Rapid Router**, operators need to see **where it came from** so appended context (brainstorm output, note excerpts) stays attached to the right ticket or task.

## Goals

- Optional **source** metadata on tasks: origin surface + opaque id (brainstorm node, note id, capture id, chat thread).
- UI affordance: “Opened from …” or badge on task detail; deep link back when possible.

## Agents

| Agent | Role |
|-------|------|
| [Project Manager Agent](../agents/project-manager-agent.md) | Plans and updates tasks with full board context (`project_manager`). |
| [Mail Clerk](../agents/mail-clerk-mailroom-agent.md) | Decomposes and places work; should preserve traceability when creating tasks (`mail_clerk`). |

## Schema sketch

See [data-model-review.md](../architecture/data-model-review.md) — `sourceKind`, `sourceId`, or `metadata Json` on `Task`.

## Dependencies

- Task create/update APIs from Brainstorm “convert plan” and future Mail Clerk tool calls must populate provenance.

## Non-goals (v1)

- Full bi-directional sync of body text across surfaces—**pointer + summary** is enough.

## Acceptance criteria

1. Creating a task from Brainstorm stores a stable reference to the idea node where supported.
2. Documentation of field names matches Prisma after migration.
