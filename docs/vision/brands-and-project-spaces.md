# Brands and project spaces

Product intent for how **companies, consultants, and clients** line up with navigation and AI.

## Terms

| User-facing | Meaning |
|-------------|---------|
| **My brands** | Sidebar switcher: each **brand** is a client or engagement. The chrome title shows the **brand display name** (Brand Center `identity.displayName`) when set; with multiple **project spaces** under one brand, the active project space name is shown after an em dash. |
| **Brand** | One row in `Brand` — one Brand Center kit (`brandProfile` JSON), ordered with other brands. Archiving a brand archives its project spaces. |
| **Project space** | A `Workspace` row scoped to a **brand** (`Workspace.brandId`). Holds project boards, tasks, notebooks, and routing for that delivery thread. |
| **Brand kit** | Saved JSON in Brand Center; stored on **`Brand.brandProfile`** (loaded/saved via any project space in that brand). |

## Implementation status

- **Data model:** Prisma **`Brand`** owns **`brandProfile`**. **`Workspace`** is the project space and references **`brandId`**. API routes under `/workspaces/:id/brand-profile` resolve the parent brand automatically.
- **UI:** Settings separates **My brands** (kit / display name, archive brand, add brand) from **Project spaces** (rename spaces and boards; when multiple brands exist, pick which brand to edit). Project space cards no longer duplicate the brand display name field.
- **Agents / context:** `formatBrandProfileForPrompt` reads kit from the brand via the active workspace; see `docs/agents/` and `docs/integrations/`.

## Related

- [glossary.md](./glossary.md)
- [context-ladder.md](./context-ladder.md)
- [../product/workspace-brand-chrome.md](../product/workspace-brand-chrome.md)
