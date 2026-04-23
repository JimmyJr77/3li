/**
 * Wraps the user's typed thought for red-team prompts (not tied to a selected board item).
 */
export function buildThoughtWorkPrompt(thought: string, instruction: string): string {
  const t = thought.trim();
  return `The user is working on this specific thought in the Brainstorm **thought** box (it is not necessarily tied to any selected board item):

"""
${t}
"""

${instruction}

The canvas snapshot below is **optional background** only — treat the thought above as the primary object unless the user explicitly connects them.`;
}

/** Red-team actions against the thought box (see BrainstormAIPanel). */
export const BRAINSTORM_THOUGHT_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Expand idea", prompt: "Expand and enrich this thought with more angles, examples, and implications." },
  {
    label: "Challenge it",
    prompt:
      "Red-team this thought: hidden assumptions, cognitive biases, blind spots, and what would falsify it. Note what could become idea vs text nodes on the board. If a draft layout helps, end with STUDIO_CANVAS_JSON.",
  },
  { label: "Alternatives", prompt: "Propose distinct alternative approaches or competing framings to this thought." },
  {
    label: "Strategic fit",
    prompt: "Connect this thought to goals, stakeholders, sequencing, and portfolio-level tradeoffs.",
  },
  {
    label: "Break it down",
    prompt: "Break this thought into smaller, testable pieces. List sub-ideas, dependencies, and sequencing.",
  },
  {
    label: "Find weaknesses",
    prompt:
      "Find weaknesses, failure modes, and what would invalidate this line of thinking. Call out bias and groupthink risks. If helpful, end with STUDIO_CANVAS_JSON draft nodes.",
  },
  { label: "Monetize this", prompt: "Explore monetization paths: pricing, buyer, unit economics, and GTM angles." },
  {
    label: "Turn into MVP",
    prompt: "Turn this into a minimal MVP: scope, build order, success metrics, and first users.",
  },
];

/**
 * Consultant session synthesis — whole board + panel log → business-facing analysis.
 * (Server uses `sessionSynthesis: true` and a dedicated system stack.)
 */
export const BRAINSTORM_SESSION_SYNTHESIS_PROMPTS: { label: string; prompt: string }[] = [
  {
    label: "Executive summary",
    prompt:
      "Produce an executive summary of this brainstorming session: what was explored, what matters most, and what decision the sponsor should focus on next.",
  },
  {
    label: "Business case draft",
    prompt:
      "Draft a concise business case synthesizing the board and panel discussion: problem, opportunity, options considered, recommendation, benefits/risks, and what would need to be true for success.",
  },
  {
    label: "Decision memo",
    prompt:
      "Write a one-page decision memo suitable for leadership: context, options, tradeoffs, recommendation, and explicit open questions.",
  },
  {
    label: "Stakeholder narrative",
    prompt:
      "Craft a stakeholder-facing narrative that explains the emerging direction, who is affected, and how to communicate it responsibly.",
  },
  {
    label: "Risks & mitigations",
    prompt:
      "Consolidate risks, dependencies, and mitigations implied across the board and session log into a prioritized portfolio view.",
  },
  {
    label: "30 / 90-day plan",
    prompt:
      "From the board and discussion, propose concrete 30-day and 90-day actions, owners (roles if unknown), and success signals.",
  },
];

/** @deprecated Use BRAINSTORM_THOUGHT_ACTIONS (subset). */
export const BRAINSTORM_QUICK_ACTIONS = BRAINSTORM_THOUGHT_ACTIONS.slice(0, 4);

/** @deprecated Use BRAINSTORM_THOUGHT_ACTIONS (subset). */
export const BRAINSTORM_LIBRARY_PROMPTS = BRAINSTORM_THOUGHT_ACTIONS.slice(4);
