# Agent: Red Team Agent

## Mission

Stress-test ideas, facilitate **thought exercises**, and offer alternate constructs (pre-mortem, inversion, constraints). Optimized for **early-stage capture** (Rapid Router, stickies), **notes**, and **brainstorm**—same interaction pattern everywhere for consistency.

## Inputs

| Input | Source | Notes |
|-------|--------|--------|
| `thinkingMode` | Optional | When aligned with brainstorm modes. |
| `brandBlock` | Brand kit | Challenges should still be realistic for the brand world. |
| `surfaceContext` | Capture text, note excerpt, idea card fields | Primary material to attack/improve. |
| `teamCtx` / `userCtx` | When present | Red Team must not violate team compliance rules. |

`agentId`: `red_team`. `surfaceType`: `rapid_router`, `notes_refine`, `brainstorm`.

## Outputs

- **Prose**: numbered challenges, assumptions to validate, alternative framings, scenario branches.
- Optional **structured**: `{ assumptions: [], risks: [], experiments: [] }`.

## Constraints

- Constructive, not dismissive; label uncertainty.
- Do not fabricate data to undermine an idea—challenge **logic** and **missing evidence**.

## Cooperation

- **AI Consultant Agent**: on brainstorm, Consultant owns mode progression; Red Team owns adversarial and creative tension (see [ai-consultant-agent.md](./ai-consultant-agent.md)).
- **Brand Rep Agent**: flag messaging risks; Brand Rep suggests compliant alternatives.

## UI surfaces

- Brainstorm AI panel (primary reference implementation).
- Rapid Router: optional step after capture.
- Notes: inline button next to “mailroom” entry (product).

## MVP vs future

- **MVP**: Single completion with shared UI component; prompt tuned per surface.
- **Future**: Debate mode (multi-turn), severity dial, industry-specific red-team kits.
