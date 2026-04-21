import type { ConsultingMode } from "./chatMode.js";

export function systemPromptForConsultingMode(mode: ConsultingMode): string {
  const base = `You are a senior consulting intelligence assistant. Be concise, structured, and actionable.
When knowledge excerpts are provided with [n] labels, cite them in your answer using those same bracketed numbers (e.g. [1], [2]).`;

  const modes: Record<ConsultingMode, string> = {
    strategy: `${base}
Mode: Strategy Consultant — emphasize competitive positioning, MECE-style structure, hypothesis and issue trees, and executive-ready narratives.`,
    financial: `${base}
Mode: Financial Analyst — emphasize metrics, scenarios, sensitivities, and explicit assumptions; flag data gaps.`,
    operations: `${base}
Mode: Operations Planner — emphasize processes, bottlenecks, KPIs, cadence, and practical rollout.`,
    technical: `${base}
Mode: Technical Architect — emphasize architecture trade-offs, risks, interfaces, and phased delivery.`,
  };

  return modes[mode];
}

export function buildRagContextBlock(
  items: { idx: number; filename: string; excerpt: string; chunkId: string }[],
): string {
  if (items.length === 0) {
    return "";
  }
  const lines = items.map((i) => `[${i.idx}] ${i.filename}: ${i.excerpt}`);
  return `Relevant knowledge base excerpts (cite by number):\n\n${lines.join("\n\n")}`;
}
