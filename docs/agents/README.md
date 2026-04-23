# 3LI agents — index

Named behavioral contracts (system prompts + context assembly). Each agent has a stable `agentId` used in [CONTEXT_BUNDLE](../integrations/CONTEXT_BUNDLE.md) and the optional unified runtime (`POST /api/ai/agent`).

## Registry

| `agentId` | Agent | Mission (one line) | Typical `surfaceType` | Context deps | Implementation status |
|-----------|--------|-------------------|----------------------|--------------|----------------------|
| `consultant` | [Consultant Agent](./consultant-agent.md) | Operator methodology; team rules override user | `chat`, `generic` | Team + user + brand + RAG | **Shipped (chat)** — `prepareConsultingTurn` merges team/user + Consultant directive; edit in Settings → Agent context |
| `ai_consultant` | [AI Consultant Agent](./ai-consultant-agent.md) | Mode-aware facilitation (Divergent → Execution) on brainstorm | `brainstorm` | Team + user + brand + thinking mode | **Shipped** — `POST /api/ai/brainstorm` + `POST /api/ai/agent` with `agentId: ai_consultant` |
| `brand_rep` | [Brand Rep Agent](./brand-rep-agent.md) | Voice, positioning, marketing soundness | any copy surface | Brand kit | **Partial** — kit injected; use `POST /api/ai/agent` + `agentId: brand_rep` for brainstorm overlay |
| `red_team` | [Red Team Agent](./red-team-agent.md) | Challenge, alternatives, pre-mortems | `brainstorm`, `rapid_router`, `notes_refine` | Team + user + brand + surface | **Partial** — brainstorm API + agent route; notes/RR need same client pattern |
| `mail_clerk` | [Mail Clerk / Mailroom](./mail-clerk-mailroom-agent.md) | Route captures to notebooks, boards, brainstorm | `rapid_router`, `notes_refine` | Workspace index + team rules | **Doc + UI wizard** — LLM routing optional |
| `notebook_linking` | [Notebook linking assistant](./notebook-linking-assistant.md) | Cross-note implications and link suggestions | `notes_refine` | Note graph + brand | **Future** — refine path is generic JSON today |
| `project_manager` | [Project Manager Agent](./project-manager-agent.md) | Agile facilitation, workload, planning scripts | `task_popup`, `boards`, `generic` | Tasks + team ctx | **Future** — needs assignee model for full vision |

## Related docs

- [agent-surface-matrix.md](./agent-surface-matrix.md) — which agents appear on which app routes and standard tools.
- [prompt-starters.md](./prompt-starters.md) — canonical short prompts for Mailroom, Red Team, PM flows (UI copy).
- [context-sources.md](./context-sources.md) — brand vs workspace resolution.
- [_template.md](./_template.md) — format for new agents.

## Context precedence

See [context ladder](../vision/context-ladder.md): **team → user → brand → workspace meta → RAG → surface**. The Consultant Agent must never override team rules.
