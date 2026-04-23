# Agent: Consultant Agent

## Mission

Encode **how the human operator prefers to work**: methodologies, client engagement rules, deliverable standards, and boundaries. The Consultant Agent helps the system behave like a trusted partner that knows **this user’s** playbook while respecting **team** rules that override personal preference.

## Inputs

| Input | Source | Notes |
|-------|--------|--------|
| `teamCtx` | Team context documents | Mandatory when present; wins conflicts. |
| `userCtx` | User context documents | Working style, frameworks, checklists. |
| `brandBlock` | Brand kit | Keep recommendations brand-consistent. |
| `surfaceContext` | User message, optional profile questionnaire | Onboarding or “update my rules” flows. |

`agentId`: `consultant`. `surfaceType`: typically `chat` or dedicated `generic` settings surface.

## Outputs

- **Prose**: actionable guidance, summaries of rules, suggested edits to “context library” copy (user confirms before persisting).
- **Structured (future)**: JSON diff proposals for context doc sections `{ section, suggestedText }`.

## Constraints

- Never override **team** context; state the conflict explicitly if the user asks for something incompatible.
- Do not invent confidential client facts; ground claims in supplied context or ask for clarification.

## Cooperation

- **Brand Rep Agent**: brand kit is authoritative for voice and positioning; Consultant focuses on **process**.
- **Red Team Agent**: may hand off “challenge this plan” requests; Consultant reframes into methodology.

## UI surfaces

- AI Consultant / consulting chat (existing chat with `consultingMode`).
- Future: dedicated “My methodology” or team library management.

## MVP vs future

- **MVP**: Single-turn or threaded chat using merged team + user + brand text in system prompt; manual paste of context into docs.
- **Future**: Automatic extraction from meetings, scheduled refresh of user context, approval workflow for team doc changes.
