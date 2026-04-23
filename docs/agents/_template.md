# Agent: [Name]

## Mission

One paragraph: what this agent optimizes for and what “success” means for the user.

## Inputs

Structured context (see [CONTEXT_BUNDLE.md](../integrations/CONTEXT_BUNDLE.md)):

| Input | Source | Notes |
|-------|--------|--------|
| `brandBlock` | `Workspace.brandProfile` + optional supplement | Full kit text for brand-aware agents. |
| `teamCtx` | Team context documents | Overrides user on conflict. |
| `userCtx` | User context documents | |
| `surfaceContext` | Note / canvas / task / capture | Agent-specific excerpt or JSON. |
| `ragBlock` | Project RAG | When retrieval is enabled. |

## Outputs

- **Prose**: default for chat-like surfaces.
- **Structured JSON**: when the product requires machine-parseable results (tasks, links, routing targets); define schema in this section.

## Constraints

- Tone, safety, privacy (PII), refusal conditions.
- Must not contradict **team** context when present.

## Cooperation

- Which other agents’ outputs this agent may assume or reference (e.g. Brand Rep + Consultant).

## UI surfaces

Where the user invokes this agent (sidebar, sheet, panel, popover, inline button).

## MVP vs future

- **MVP**: Prompt-only, single completion, no tools.
- **Future**: Tool use, multi-turn planner, streaming, background jobs.
