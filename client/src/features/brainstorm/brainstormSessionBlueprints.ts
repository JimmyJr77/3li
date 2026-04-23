import type { ThinkingMode } from "@/features/brainstorm/stores/brainstormStore";

/** Session types the agent can run entirely inside Brainstorm Studio (canvas primitives). */
export type BrainstormSessionBlueprint = {
  id: string;
  label: string;
  summary: string;
  thinkingMode: ThinkingMode;
  /** Sent to the model after the user states their goal. */
  agentBrief: string;
};

export const BRAINSTORM_SESSION_BLUEPRINTS: BrainstormSessionBlueprint[] = [
  {
    id: "divergent_ideas",
    label: "Divergent idea storm",
    summary: "Many idea cards, tags, and angles — quantity before quality.",
    thinkingMode: "divergent",
    agentBrief:
      "Lead a divergent pass: many distinct idea-card concepts, varied lenses, and explicit deferral of judgment. End by naming how the board should evolve (new idea cards vs text callouts). Offer optional STUDIO_CANVAS_JSON if the user wants drafts on the board.",
  },
  {
    id: "assumption_red_team",
    label: "Assumption & bias challenge",
    summary: "Surface hidden assumptions, cognitive biases, and blind spots as cards or text.",
    thinkingMode: "strategic",
    agentBrief:
      "Stress-test assumptions and biases (confirmation, sunk cost, availability, groupthink, anchoring). Map each to a concrete risk or test. Use studio tools: idea cards for claims, text blocks for counter-evidence prompts. Offer STUDIO_CANVAS_JSON when the user agrees to materialize.",
  },
  {
    id: "premortem",
    label: "Pre-mortem / failure modes",
    summary: "Assume failure: work backward from a bad outcome to risks and mitigations.",
    thinkingMode: "strategic",
    agentBrief:
      "Run a pre-mortem: vivid failure scenario, contributing factors, early warning signals, mitigations. Prefer idea cards for risks/mitigations and hierarchy or text for timelines. Red-team tone, constructive. Offer STUDIO_CANVAS_JSON if they want nodes drafted.",
  },
  {
    id: "decision_compare",
    label: "Decision comparison",
    summary: "Converge on options, tradeoffs, and a recommendation using cards and/or a table.",
    thinkingMode: "convergent",
    agentBrief:
      "Compare options with explicit criteria, tradeoffs, and a clear recommendation. Reference that they can use a Table node for matrices and idea cards per option. Offer STUDIO_CANVAS_JSON for draft option cards or summary text blocks.",
  },
  {
    id: "stakeholder_map",
    label: "Stakeholder & influence map",
    summary: "Containers or hierarchy for actors, interests, and red-team pushback.",
    thinkingMode: "strategic",
    agentBrief:
      "Map stakeholders: incentives, risks of misunderstanding, and where alignment could fail. Suggest container frames for groups and idea cards per actor. Red-team where incentives conflict. Offer STUDIO_CANVAS_JSON for a starter layout.",
  },
  {
    id: "story_arc",
    label: "Narrative / story arc",
    summary: "Hierarchy + idea cards for beats, tensions, and open questions.",
    thinkingMode: "divergent",
    agentBrief:
      "Shape a narrative arc: tension, turning points, open questions. Hierarchy nodes work well for sequences; idea cards for beats or insights. Challenge weak narrative logic. Offer STUDIO_CANVAS_JSON for starter branches or cards.",
  },
  {
    id: "execution_bridge",
    label: "Execution bridge",
    summary: "Turn the board toward concrete steps; mention Convert to plan on idea cards.",
    thinkingMode: "execution",
    agentBrief:
      "Move from concepts to ordered steps, owners, dependencies, and validation. Remind them idea cards can become backlog tasks via Convert to plan when ready. Red-team unrealistic sequencing. Offer STUDIO_CANVAS_JSON for checklist-style text or idea stubs.",
  },
  {
    id: "workshop_frames",
    label: "Workshop in frames",
    summary: "Shapes + containers as zones; text and ideas inside a facilitated flow.",
    thinkingMode: "divergent",
    agentBrief:
      "Design a lightweight workshop layout using container frames and labeled zones (text + idea cards). Call out facilitation bias (leading questions, uneven airtime). Offer STUDIO_CANVAS_JSON only for text/idea seeds that fit the described layout.",
  },
];

export function buildFacilitatorPrompt(goal: string, blueprint: BrainstormSessionBlueprint): string {
  const g = goal.trim() || "(Goal not stated — ask one clarifying question first, then proceed.)";
  return `The user chose this Brainstorm Studio session type: **${blueprint.label}** (${blueprint.summary}).

User goal / outcome they want to work toward:
---
${g}
---

Instructions for you:
${blueprint.agentBrief}

Ground every suggestion in what Brainstorm Studio can actually do (idea cards, text, hierarchy, shapes, tables, container frames, images, links between nodes, thinking modes, and converting idea cards to backlog tasks). Be red-team forward: challenge weak reasoning, unstated assumptions, and bias — stay respectful and constructive.

If a concrete board draft would help, you may append the machine-readable STUDIO_CANVAS_JSON block described in your system instructions (the user can add those nodes in one click).`;
}
