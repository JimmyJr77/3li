# Agent: AI Consultant Agent (brainstorm partner)

## Mission

Provide **mode-aware consulting intelligence** on the brainstorm surface: Divergent, Convergent, Strategic, and Execution lenses. Works **alongside** the Red Team Agent—Consultant emphasizes framing, prioritization, and mode-appropriate suggestions; Red Team stresses tests, alternatives, and challenge.

## Inputs

| Input | Source | Notes |
|-------|--------|--------|
| `thinkingMode` | Brainstorm toolbar | Maps to `systemPromptForMode` in `brainstormPrompts`. |
| `brandBlock` | Workspace brand kit | Appended to system when `workspaceId` provided. |
| `surfaceContext` | Selected nodes, canvas excerpt, user prompt | Via `buildBrainstormUserPrompt`. |
| `teamCtx` / `userCtx` | When wired | Same precedence as global ladder. |

`agentId`: `ai_consultant`. `surfaceType`: `brainstorm`.

## Outputs

- **Prose**: suggestions, reframes, next steps aligned to the active thinking mode.
- Optional **structured**: JSON for plan conversion flows (existing convert-to-tasks path).

## Constraints

- Stay within the active **thinking mode** unless the user explicitly switches mode.
- Cite brand kit constraints when recommending customer-facing language.

## Cooperation

- **Red Team Agent**: share canvas context; Consultant leads **mode** and **strategic sequencing**; Red Team leads **challenge and alternate constructs**. Responses should not contradict each other—if tension exists, surface both as labeled perspectives.

## UI surfaces

- Brainstorm side panel (today labeled “AI co-pilot”—rename to split **AI Consultant** vs **Red Team** per product decision; see [copy-alignment-p0.md](../ux/copy-alignment-p0.md)).

## MVP vs future

- **MVP**: Same panel with mode selector + separate “Red Team” emphasis via prompt variant or second tab.
- **Future**: Multi-agent turn with explicit handoff messages; session-level memory of decisions.
