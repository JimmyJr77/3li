import type { BrainstormFlowNode, IdeaFlowNode } from "@/features/brainstorm/types";
import { isIdeaNode } from "@/features/brainstorm/types";

function ideaNodesOnly(nodes: BrainstormFlowNode[]): IdeaFlowNode[] {
  return nodes.filter(isIdeaNode);
}

export function buildCanvasSummary(nodes: BrainstormFlowNode[], maxLines = 24): string {
  const ideas = ideaNodesOnly(nodes);
  if (ideas.length === 0) {
    if (nodes.length === 0) {
      return "(Canvas is empty.)";
    }
    return `(Canvas has ${nodes.length} element(s); idea cards: none. Add an idea card for a structured summary here.)`;
  }
  const lines = ideas.map((n, i) => {
    const tags = n.data.tags.length ? ` [${n.data.tags.join(", ")}]` : "";
    return `${i + 1}. ${n.data.title}${tags} — ${n.data.status}/${n.data.priority}`;
  });
  return lines.slice(0, maxLines).join("\n");
}

export function buildSelectedNodeSummary(node: BrainstormFlowNode | undefined): string | undefined {
  if (!node) {
    return undefined;
  }
  if (isIdeaNode(node)) {
    const cap = (node.data.captionText ?? "").trim();
    const parts = [
      `Title: ${node.data.title}`,
      node.data.description ? `Notes: ${node.data.description}` : "",
      `Status: ${node.data.status}, Priority: ${node.data.priority}`,
      node.data.tags.length ? `Tags: ${node.data.tags.join(", ")}` : "",
      cap ? `Caption: ${cap}` : "",
    ].filter(Boolean);
    return parts.join("\n");
  }
  if (node.type === "shape") {
    if (node.data.stencilLibrary !== "basic") {
      const cap = (node.data.captionText ?? node.data.caption ?? "").trim();
      const pid = node.data.presetId ?? "";
      return `Shape [${node.data.stencilLibrary}] ${pid}${cap ? `: ${cap}` : ""}`.slice(0, 800);
    }
    const cap = (node.data.captionText ?? "").trim();
    if (cap) return `Shape (${node.data.variant}): ${cap.slice(0, 800)}`;
    const plain = node.data.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return `Shape (${node.data.variant}): ${plain.slice(0, 800)}`;
  }
  if (node.type === "image") {
    const alt = (node.data.alt ?? "").trim();
    const cap = (node.data.captionText ?? "").trim();
    const bits = [cap ? `Caption: ${cap}` : "", alt ? `Alt: ${alt}` : ""].filter(Boolean);
    return `Image${bits.length ? ` — ${bits.join(" · ")}` : ""} (${node.data.src.startsWith("data:") ? "embedded" : "url"})`;
  }
  if (node.type === "table") {
    const cap = (node.data.captionText ?? "").trim();
    const flat = node.data.rows.map((r) => r.join(" | ")).join(" / ");
    const grid = flat.replace(/\s+/g, " ").trim().slice(0, 800);
    return cap ? `Table — ${cap}: ${grid}` : `Table: ${grid}`;
  }
  if (node.type === "text") {
    const cap = (node.data.captionText ?? "").trim();
    if (cap) return `Text: ${cap.slice(0, 800)}`;
    const plain = node.data.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return `Text: ${plain.slice(0, 800)}`;
  }
  if (node.type === "hierarchy") {
    const cap = (node.data.captionText ?? "").trim();
    return `Hierarchy: ${cap || node.data.label}`.slice(0, 800);
  }
  return undefined;
}
