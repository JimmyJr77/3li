# P0 copy and entry-point alignment

Checklist for engineering when implementing the brand/agent UX. **No code changes in this documentation pass**—this file is the implementation checklist.

## 1. Sidebar and shell: `3LI Workspace` → active brand/workspace name

| Location | File | Status |
|----------|------|--------|
| Desktop sidebar title | [WorkspaceSidebarColumn.tsx](../../client/src/components/layout/WorkspaceSidebarColumn.tsx) | Done — [`WorkspaceBrandSwitcher`](../../client/src/components/layout/WorkspaceBrandSwitcher.tsx) |
| Mobile header | [AppLayout.tsx](../../client/src/components/layout/AppLayout.tsx) | Done — same switcher |
| Marketing / solutions | [SolutionsPage.tsx](../../client/src/pages/SolutionsPage.tsx) | Done — section title **Project spaces and tools** (not the old chrome string) |

**Character limit:** enforce on workspace rename/create (e.g. 64 chars DB, 28–32 display in sidebar)—see [workspace-brand-chrome.md](../product/workspace-brand-chrome.md).

## 2. Brainstorm → product naming

In-app chrome uses **Brainstorm** and **studio boards**; server brainstorm `BASE` prompt matches. The plan called out:

- User-facing **session** language → **studio board** in copy where it refers to a canvas instance (toolbar, session picker, toasts).
- Files to update when doing a copy pass:

| File | Notes |
|------|--------|
| [client/src/config/workspaceNav.tsx](../../client/src/config/workspaceNav.tsx) | Nav label |
| [client/src/components/workspace/WorkspaceDashboardHomeGrid.tsx](../../client/src/components/workspace/WorkspaceDashboardHomeGrid.tsx) | Home tile |
| [client/src/features/brainstorm/components/BrainstormToolbar.tsx](../../client/src/features/brainstorm/components/BrainstormToolbar.tsx) | Page title |
| [client/src/pages/RapidRouterPage.tsx](../../client/src/pages/RapidRouterPage.tsx) | Destination chip + success toast |
| [client/src/features/notes/AtlasNotesApp.tsx](../../client/src/features/notes/AtlasNotesApp.tsx) | Button + `title` tooltip |
| [client/src/pages/MyTasksPage.tsx](../../client/src/pages/MyTasksPage.tsx) | Empty-state link text |
| [client/src/features/brainstorm/index.ts](../../client/src/features/brainstorm/index.ts) | Module comment |
| [client/src/features/brainstorm/brainstormNoteImport.ts](../../client/src/features/brainstorm/brainstormNoteImport.ts) | Comment |

## 3. AI co-pilot → Red Team Agent / AI Consultant

| Location | File | Current | Target |
|----------|------|---------|--------|
| Brainstorm AI panel heading | [client/src/features/brainstorm/components/BrainstormAIPanel.tsx](../../client/src/features/brainstorm/components/BrainstormAIPanel.tsx) | `AI co-pilot` | Split UI: e.g. **Red Team Agent** (challenge) vs **AI Consultant** (mode-aligned)—or a single panel with two tabs per [ai-consultant-agent.md](../agents/ai-consultant-agent.md) / [red-team-agent.md](../agents/red-team-agent.md). |
| Server system prompt base | [server/src/lib/openai/brainstormPrompts.ts](../../server/src/lib/openai/brainstormPrompts.ts) | “AI co-pilot for 3LI Brainstorm Studio” | Align wording with chosen agent split; keep behavior stable. |

## 4. Mailroom entry vs Brainstorm shortcut (notes and global)

**Goal:** Where the product currently jumps straight to **Brainstorm Studio** (e.g. notes toolbar), add or substitute a **Mail Clerk / Mailroom** action that opens the **standardized routing** popup (see [mail-clerk-mailroom-agent.md](../agents/mail-clerk-mailroom-agent.md)).

| File | Current behavior | Target |
|------|------------------|--------|
| [client/src/features/notes/AtlasNotesApp.tsx](../../client/src/features/notes/AtlasNotesApp.tsx) | Primary button to Brainstorm Studio | Add Mailroom (routing) primary or secondary; keep brainstorm export as explicit choice. |
| [client/src/config/workspaceNav.tsx](../../client/src/config/workspaceNav.tsx) | Rapid Router already listed | Ensure IA matches “capture → route” story. |

Implementation detail: new component (sheet/modal) with steps from agent doc; optional reuse of `RapidRouterPage` destination model.

## 5. Toasts and analytics

When renaming strings, search for duplicate user-visible copies:

```bash
rg 'Brainstorm Studio|AI co-pilot|3LI Workspace' client server
```

Update any analytics event labels if events key off display strings.
