# PRD: Brainstorm (studio boards)

## Problem

Teams need a **master** ideation surface with flexible artifacts beyond cards: text, shapes, charts, calculators, tables, images, and export to notebooks.

## Goals

- Rename product copy from **session** to **studio board** where user-facing (`BrainstormSession` may remain internal).
- **Board lifecycle**: independent (pre-project), **creates new project space**, or **assigned** to existing workspace—**phased**; v1 likely attach-only to reduce migration risk.
- **AI Consultant** (modes: Divergent, Convergent, Strategic, Execution) + **Red Team Agent** in a **collapsible** panel matching notebooks/chat fold behavior.
- Rename “AI co-pilot” to align with **Red Team** / **AI Consultant** split (see UX doc).
- **Snapshots** to notebooks → holding pen or chosen folder.

## Current implementation (reference)

- `BrainstormSession`, `IdeaNode`, modes in `brainstormPrompts.js`.
- AI panel: `BrainstormAIPanel.tsx`.
- Note import: `brainstormNoteImport.ts`.

## Open questions

- Canvas feature parity timeline (calculators, PowerPoint-like objects) vs incremental widgets.
- Auto-creating a **new `Workspace`** when “new project” is selected—coordination with boards and notes indexes.

## Agents

- **AI Consultant Agent** (`ai-consultant-agent.md`) for mode-aligned facilitation.
- **Red Team Agent** for challenge and alternates.
- **Brand Rep** optional for customer-facing copy on cards.

## Acceptance criteria

- Thinking mode always visible in AI requests (existing behavior preserved).
- Snapshot export produces a note the user can find (title + tag convention).
