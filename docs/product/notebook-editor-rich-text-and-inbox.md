# PRD: Notebook editor, project linkage, and Rapid Router inbox

**Phase tags:** P1 UX shell → P2 data (many-to-many notes ↔ project spaces) → P3 agent tools.

## Problem

Notebooks must balance **structured silos** (folders/notebooks) with **cross-talk** across subjects. Operators need a **calm** editor (not as dense as Brainstorm Studio) with practical formatting, plus a **holding area** for raw forwards from Rapid Router and other surfaces before filing.

## Goals

- Rich but simple editing: headings, lists, checkboxes, links, tables, image drag-and-drop into content.
- **Rapid Router / inbox** region per notebook (or workspace): raw captures that can be **moved** into the proper notebook/section later.
- **Project space association**: notebooks (and optionally individual notes) assignable to none, one, many, or all project spaces; creating a new project space from notebooks should create the corresponding row under Project Boards (coordination with boards API).

## Agents

| Agent | Role |
|-------|------|
| [Notebook linking assistant](../agents/notebook-linking-assistant.md) | Suggest links and cross-note implications (`notebook_linking`). |
| [Red Team Agent](../agents/red-team-agent.md) | Thought exercises inline (`red_team`, `notes_refine`). |
| [Mail Clerk](../agents/mail-clerk-mailroom-agent.md) | Route content to the right silo (`mail_clerk`). |

## Dependencies

- [data-model-review.md](../architecture/data-model-review.md) — note ↔ multiple project spaces not migrated yet.
- Editor stack (existing Note editor) and asset upload strategy.

## Non-goals (initial slice)

- Full Notion-style databases; Brainstorm-caliber freeform widgets inside notes.

## Acceptance criteria (incremental)

1. Documented contract for inbox/holding pen (folder flag vs tag) before implementation.
2. Agent matrix row for Notes updated when each slice ships ([agent-surface-matrix](../agents/agent-surface-matrix.md)).
