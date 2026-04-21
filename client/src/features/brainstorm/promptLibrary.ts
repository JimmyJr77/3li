/**
 * Quick actions — fast iteration on the selected idea (overview Part 3 + Part 4).
 */
export const BRAINSTORM_QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Expand idea", prompt: "Expand and enrich this idea with more angles, examples, and implications." },
  { label: "Challenge idea", prompt: "Critique this idea: risks, blind spots, and what could go wrong." },
  { label: "Alternatives", prompt: "Propose distinct alternative approaches or competing solutions." },
  { label: "Strategic fit", prompt: "Connect this idea to goals, stakeholders, and sequencing." },
];

/**
 * Prompt library — pre-built prompts from product overview (module 10).
 */
export const BRAINSTORM_LIBRARY_PROMPTS: { label: string; prompt: string }[] = [
  { label: "Break this idea", prompt: "Break this idea into smaller, testable pieces. List sub-ideas and dependencies." },
  { label: "Find weaknesses", prompt: "Find weaknesses, failure modes, and what would invalidate this idea." },
  { label: "Monetize this", prompt: "Explore monetization paths: pricing, buyer, unit economics, and GTM angles." },
  { label: "Turn into MVP", prompt: "Turn this into a minimal MVP: scope, build order, success metrics, and first users." },
];
