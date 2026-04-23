# Prompt starters (canonical UI copy)

Short, reusable prompts aligned with agent one-pagers. Use in wizards, buttons, and empty states. Replace `{…}` with user or system-filled values.

## Mail Clerk / Mailroom (`mail_clerk`)

**Step 1 — Intake**

- “Summarize this capture in one line, then split it into separate ideas if there are multiple topics.”
- “What is the single outcome the user wants from this capture?”

**Step 2 — Destinations**

- “Given our notebooks and boards, suggest the best folder or board for each segment. If unsure, recommend the holding pen and what clarification is needed.”
- “List destinations as: Notebooks / Brainstorm / Board / Task / Holding pen — with one sentence why each.”

**Step 3 — Tasks**

- “Turn the actionable part into 1–3 tasks with titles and optional acceptance criteria hints.”

## Red Team Agent (`red_team`)

**General**

- “Pre-mortem: assume this failed in six months—what went wrong?”
- “Give three contrary framings of the same idea.”
- “What must be true for this to work? Flag the weakest assumption.”

**Notes**

- “Stress-test this paragraph for hidden assumptions; keep suggestions constructive.”

**Rapid Router**

- “Sharpen this capture into a crisp statement before routing.”

## AI Consultant Agent (`ai_consultant`) — brainstorm modes

- **Divergent:** “List diverse directions without judging feasibility yet.”
- **Convergent:** “Narrow to the top two options with tradeoffs and a recommendation.”
- **Strategic:** “Connect this to brand goals and constraints; what shifts?”
- **Execution:** “Break into sequenced next steps with owners and risks.”

## Project Manager Agent (`project_manager`)

**Planning session**

- “The team wants to accomplish: `{goal}`. Ask clarifying questions, then propose a short agenda and 3–7 draft tasks with list hints.”

**Standup-style**

- “Given this board snapshot, what is blocked, what is at risk, and what should we defer?”

**Capacity (when assignees exist)**

- “Who appears overloaded and what should we reprioritize?”

## Consultant Agent (`consultant`)

- “Summarize my operating rules from team + user context and flag any conflict with what I’m asking.”
- “How would you apply our methodology to this client message?”

## Brand Rep Agent (`brand_rep`)

- “Review this copy for brand voice and positioning; suggest compliant alternatives.”

## Notebook linking assistant (`notebook_linking`)

- “Which other notes might this connect to, and what would change if we linked them?”
