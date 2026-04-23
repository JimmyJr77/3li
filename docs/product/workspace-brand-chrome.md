# PRD: Workspace brand chrome and switching

## Problem

Users working multiple brands need the shell to show **which brand they are working on**, with a consistent length for layout. The signed-in app sidebar uses a **brand-first label** (Settings brand name, then Brand Center kit display name, then workspace title) so the chrome matches “the client in play,” truncated with a tooltip. The switcher list is labeled **My brands**. Public marketing (e.g. Solutions) describes **brands, project spaces, and tools**.

## Current schema (authoritative)

- **`Brand`** ([prisma/schema.prisma](../../prisma/schema.prisma)): canonical `name`, `brandProfile` JSON (identity kit for AI), `position`, `archivedAt`.
- **`Workspace`**: **one per brand** (`brandId` unique)—ecosystem row for notes, brainstorm `Project`, etc. `Workspace.name` is a human label (e.g. `{brand} Workspace`); it is **not** the primary brand name for chrome when brand display names exist.

See [brands-and-project-spaces.md](../vision/brands-and-project-spaces.md) and [data-model-review.md](../architecture/data-model-review.md).

## Goals

- Sidebar title reflects the **active brand** (not a generic “3LI Workspace” string).
- Truncation + tooltip for long names (policy: **28** visible characters in client constants; DB name max **64**).
- If the user has **multiple workspaces**, they can switch **from the sidebar** without logging out.
- Validate **max length** on create/rename (client + API).

## Non-goals (v1)

- One `Brand` spanning **multiple** `Workspace` rows (would require a schema change and membership rules).

## User stories

- As an operator, I see my current client/brand name at the top of the sidebar.
- As an operator with several workspaces, I open a picker from the title area and select another workspace; scoped data refreshes.

## Resolved / open

- **Chrome label:** Prefer **brand mention** (Settings `brandName` → kit `identity.displayName` → `Workspace.name`) for the top bar; full string in tooltip when truncated.
- **Last active workspace:** Persisted in `localStorage` per browser ([`ACTIVE_WORKSPACE_STORAGE_KEY`](../../client/src/lib/workspaceConstants.ts)); server-side per-user persistence awaits auth/membership.

## Dependencies

- Workspace list API and bootstrap (existing on chat/boards/notes flows).
- Future: auth-bound **membership** (see data model review).

## Acceptance criteria

- Title never shows stale name after switch.
- Truncation does not break layout on narrow sidebars.
