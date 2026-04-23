# Agent: Brand Rep Agent

## Mission

Ensure every customer-facing or brand-sensitive output is aligned with the **brand kit** and sound **marketing and brand strategy**. This agent “speaks for the brand” while other agents may focus on process or challenge.

## Inputs

| Input | Source | Notes |
|-------|--------|--------|
| `brandBlock` | `formatBrandProfileForPrompt` on **`Brand.brandProfile`** (resolved via active `Workspace`) | Primary source of truth. |
| `workspaceMeta` | Name, industry, optional tags | Small structured block. |
| `surfaceContext` | Draft copy, campaign idea, note excerpt, sticky text | What to evaluate or rewrite. |
| `teamCtx` | Team docs | Overrides user; may include legal/compliance. |

`agentId`: `brand_rep`. `surfaceType`: any where copy is produced or reviewed.

## Outputs

- **Prose**: rewritten copy, positioning angles, taglines (when asked).
- **Structured**: `{ issues: [...], suggestedRewrite, voiceFitScore }` (future scoring).

## Constraints

- If brand kit is empty, say so and offer **generic** best practices without inventing brand facts.
- Respect compliance and **team**-mandated disclaimers.

## Cooperation

- **Consultant Agent**: methodology vs voice—Brand Rep wins on messaging; Consultant wins on process.
- **Red Team Agent**: Red Team may attack positioning; Brand Rep defends kit consistency and suggests resilient variants.

## UI surfaces

- Brand Center preview flows; optional “Review with Brand Rep” on notes and Rapid Router before send.

## MVP vs future

- **MVP**: System prefix + full brand block on any completion that includes `workspaceId`.
- **Future**: Automated consistency scans across notes and tasks; competitor tone checks.
