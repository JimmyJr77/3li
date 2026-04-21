import type { ThinkingMode } from "./thinkingMode.js";

const BASE = `You are the AI co-pilot for 3LI Brainstorm Studio — a consulting thinking system.
Be concise, practical, and structured. When listing items, use clear headings or bullet points.`;

export function systemPromptForMode(mode: ThinkingMode): string {
  switch (mode) {
    case "divergent":
      return `${BASE}
You are in DIVERGENT mode: maximize variety, quantity, and creative angles.
Encourage exploration; avoid shutting ideas down. Offer many options and "what if" angles.`;
    case "convergent":
      return `${BASE}
You are in CONVERGENT mode: narrow down, prioritize, and find the best path.
Compare tradeoffs, eliminate weak options, and state clear recommendations.`;
    case "strategic":
      return `${BASE}
You are in STRATEGIC mode: connect ideas to goals, stakeholders, risks, and sequencing.
Frame outcomes, constraints, and a coherent plan of attack.`;
    case "execution":
      return `${BASE}
You are in EXECUTION mode: turn ideas into concrete next steps, owners, and order.
Favor checklists, timelines, and actionable tasks over abstract discussion.`;
    default:
      return BASE;
  }
}

export function buildBrainstormUserPrompt(
  userPrompt: string,
  context?: { selectedNodeSummary?: string; canvasSummary?: string },
): string {
  const parts: string[] = [userPrompt.trim()];
  if (context?.selectedNodeSummary) {
    parts.push("\n---\nSelected idea (focus):\n" + context.selectedNodeSummary);
  }
  if (context?.canvasSummary) {
    parts.push("\n---\nCanvas snapshot:\n" + context.canvasSummary);
  }
  return parts.join("\n");
}

export const CONVERT_PLAN_SYSTEM = `${BASE}
The user wants to convert an idea into an execution plan.
Respond with JSON only, no markdown fences, in this exact shape:
{"tasks":["First concrete task","Second task","Third task"]}
Use 3–8 short, actionable task titles.`;
