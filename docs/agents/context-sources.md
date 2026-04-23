# Agent context sources (brand vs project space)

Use this when wiring prompts or tools so agents pull the right data.

| Layer | Storage | How to resolve from UI |
|--------|---------|-------------------------|
| **Brand kit** (voice, positioning, constraints) | `Brand.brandProfile` (JSON) | Active **project space** (`Workspace`) → `brandId` → brand row. API: `GET/PUT /api/task-app/workspaces/:workspaceId/brand-profile` updates the parent brand. |
| **Project space** (delivery thread label) | `Workspace.name` | Scoped per brand; switching workspace may stay within the same brand. |
| **Formatted kit text** | `formatBrandProfileForPrompt` | Server loads brand via workspace id (`loadBrandProfileJsonForWorkspaceId`). |

**Team vs user context** (Consultant Agent, notebooks, etc.) remains layered as in `context-ladder.md`; team rules override user rules on conflict.

Related: [brand-rep-agent.md](./brand-rep-agent.md), [../vision/brands-and-project-spaces.md](../vision/brands-and-project-spaces.md).
