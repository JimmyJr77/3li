import type { IdeaFlowNode } from "@/features/brainstorm/types";

export function buildCanvasSummary(nodes: IdeaFlowNode[], maxLines = 24): string {
  if (nodes.length === 0) {
    return "(Canvas is empty.)";
  }
  const lines = nodes.map((n, i) => {
    const tags = n.data.tags.length ? ` [${n.data.tags.join(", ")}]` : "";
    return `${i + 1}. ${n.data.title}${tags} — ${n.data.status}/${n.data.priority}`;
  });
  return lines.slice(0, maxLines).join("\n");
}

export function buildSelectedNodeSummary(node: IdeaFlowNode | undefined): string | undefined {
  if (!node) {
    return undefined;
  }
  const parts = [
    `Title: ${node.data.title}`,
    node.data.description ? `Notes: ${node.data.description}` : "",
    `Status: ${node.data.status}, Priority: ${node.data.priority}`,
    node.data.tags.length ? `Tags: ${node.data.tags.join(", ")}` : "",
  ].filter(Boolean);
  return parts.join("\n");
}
