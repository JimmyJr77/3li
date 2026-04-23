# PRD: Notebooks

## Problem

Businesses need **silos** (notebooks) with **cross-talk** (links and implications across notes). Operators need rich but calm editing, an **inbox** for raw forwards, and optional association to **project spaces**.

## Goals

- **Holding pen / raw forwards** section per notebook (and ability to promote into proper structure).
- **Rich editor** (phased): headings, lists, checkboxes, links, tables, images drag-and-drop—simpler than brainstorm canvas.
- **Notebook linking assistant** suggests `NoteLink` edges and explains cross-note implications.
- **Associations**: notebook and note assignable to **zero / one / many project spaces** (workspace-scoped), with notes able to diverge from parent notebook—**schema work** (see data model review).
- **Brainstorm snapshots** import into notebooks (extend existing note import patterns).

## Current implementation (reference)

- `Note`, `NotesFolder`, `NoteTag`, `NoteLink` under `Workspace` in Prisma.
- Notes app: `AtlasNotesApp`, quick capture sheet.

## Open questions

- Folder convention vs explicit **`isInbox`** flag for holding pens.
- Image storage (uploads service, size limits).
- Conflict when note’s project spaces differ from notebook’s—UI rules.

## Agents

- **Mail Clerk**: omnipresent entry → routing popup (replaces some Brainstorm-only shortcuts).
- **Red Team Agent**: inline thought exercises.
- **Notebook linking assistant**: graph suggestions.

## Acceptance criteria

- Link suggestions require explicit user confirm before creating `NoteLink` rows (MVP).
