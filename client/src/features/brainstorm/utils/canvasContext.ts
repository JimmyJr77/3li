import type { BrainstormFlowNode, ContainerFlowNode, IdeaFlowNode } from "@/features/brainstorm/types";
import { isIdeaNode } from "@/features/brainstorm/types";

function ideaNodesOnly(nodes: BrainstormFlowNode[]): IdeaFlowNode[] {
  return nodes.filter(isIdeaNode);
}

/** Ancestor containers from outermost to innermost (relative to `nodeId`). */
function ancestorContainersOuterToInner(
  nodes: BrainstormFlowNode[],
  nodeId: string,
): ContainerFlowNode[] {
  const chain: ContainerFlowNode[] = [];
  let cur = nodes.find((n) => n.id === nodeId);
  while (cur?.parentId) {
    const p = nodes.find((n) => n.id === cur!.parentId);
    if (p?.type === "container") chain.push(p as ContainerFlowNode);
    cur = p;
  }
  return chain.reverse();
}

/** Prefix for AI summaries so nested group context is explicit. */
export function inheritedContainerContextPrefix(nodes: BrainstormFlowNode[], nodeId: string): string {
  const chain = ancestorContainersOuterToInner(nodes, nodeId);
  if (chain.length === 0) return "";
  const blocks = chain.map((c) => {
    const parts: string[] = [];
    const cap = ((c.data.outsideCaptionText ?? "").trim() || (c.data.captionText ?? "").trim());
    const notes = (c.data.contextNotes ?? "").trim();
    if (cap) parts.push(`Group label: ${cap}`);
    if (notes) parts.push(`Group context: ${notes}`);
    return parts.length ? parts.join("\n") : "";
  }).filter(Boolean);
  if (blocks.length === 0) return "";
  return `--- From containing frame(s) ---\n${blocks.join("\n---\n")}\n---\n`;
}

export function buildCanvasSummary(nodes: BrainstormFlowNode[], maxLines = 24): string {
  const ideas = ideaNodesOnly(nodes);
  const containers = nodes.filter((n) => n.type === "container");
  const lines: string[] = [];

  if (containers.length > 0) {
    lines.push(`Containers (${containers.length}):`);
    for (const c of containers.slice(0, 8)) {
      const cap = ((c.data.outsideCaptionText ?? "").trim() || (c.data.captionText ?? "").trim());
      const notes = (c.data.contextNotes ?? "").trim();
      const bits = [cap || "(no label)", notes ? `context: ${notes.slice(0, 120)}${notes.length > 120 ? "…" : ""}` : ""]
        .filter(Boolean)
        .join(" — ");
      lines.push(`- ${bits}`);
    }
    if (containers.length > 8) lines.push(`- …and ${containers.length - 8} more`);
    lines.push("");
  }

  if (ideas.length === 0) {
    if (nodes.length === 0) {
      return lines.length ? lines.join("\n").trimEnd() + "\n(Canvas is empty.)" : "(Canvas is empty.)";
    }
    lines.push(
      `(Canvas has ${nodes.length} element(s); idea cards: none. Add an idea card for a structured summary here.)`,
    );
    return lines.slice(0, maxLines).join("\n");
  }
  const ideaLines = ideas.map((n, i) => {
    const tags = n.data.tags.length ? ` [${n.data.tags.join(", ")}]` : "";
    return `${i + 1}. ${n.data.title}${tags} — ${n.data.status}/${n.data.priority}`;
  });
  return [...lines, ...ideaLines].slice(0, maxLines).join("\n");
}

export function buildSelectedNodeSummary(
  node: BrainstormFlowNode | undefined,
  allNodes?: BrainstormFlowNode[],
): string | undefined {
  if (!node) {
    return undefined;
  }
  let body: string | undefined;
  if (isIdeaNode(node)) {
    const inside = (node.data.captionText ?? "").trim();
    const outside = (node.data.outsideCaptionText ?? "").trim();
    const parts = [
      `Title: ${node.data.title}`,
      node.data.description ? `Notes: ${node.data.description}` : "",
      `Status: ${node.data.status}, Priority: ${node.data.priority}`,
      node.data.tags.length ? `Tags: ${node.data.tags.join(", ")}` : "",
      inside ? `Text on card: ${inside}` : "",
      outside ? `Outside label: ${outside}` : "",
    ].filter(Boolean);
    body = parts.join("\n");
  } else if (node.type === "shape") {
    if (node.data.stencilLibrary !== "basic") {
      const cap = (
        (node.data.outsideCaptionText ?? "").trim() ||
        (node.data.captionText ?? node.data.caption ?? "").trim()
      );
      const pid = node.data.presetId ?? "";
      body = `Shape [${node.data.stencilLibrary}] ${pid}${cap ? `: ${cap}` : ""}`.slice(0, 800);
    } else {
      const cap = ((node.data.outsideCaptionText ?? "").trim() || (node.data.captionText ?? "").trim());
      if (cap) body = `Shape (${node.data.variant}): ${cap.slice(0, 800)}`;
      else {
        const plain = node.data.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        body = `Shape (${node.data.variant}): ${plain.slice(0, 800)}`;
      }
    }
  } else if (node.type === "image") {
    const alt = (node.data.alt ?? "").trim();
    const cap = ((node.data.outsideCaptionText ?? "").trim() || (node.data.captionText ?? "").trim());
    const bits = [cap ? `Caption: ${cap}` : "", alt ? `Alt: ${alt}` : ""].filter(Boolean);
    body = `Image${bits.length ? ` — ${bits.join(" · ")}` : ""} (${node.data.src.startsWith("data:") ? "embedded" : "url"})`;
  } else if (node.type === "table") {
    const cap = ((node.data.outsideCaptionText ?? "").trim() || (node.data.captionText ?? "").trim());
    const flat = node.data.rows.map((r) => r.join(" | ")).join(" / ");
    const grid = flat.replace(/\s+/g, " ").trim().slice(0, 800);
    body = cap ? `Table — ${cap}: ${grid}` : `Table: ${grid}`;
  } else if (node.type === "text") {
    const cap = ((node.data.outsideCaptionText ?? "").trim() || (node.data.captionText ?? "").trim());
    if (cap) body = `Text: ${cap.slice(0, 800)}`;
    else {
      const plain = node.data.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      body = `Text: ${plain.slice(0, 800)}`;
    }
  } else if (node.type === "hierarchy") {
    const cap = ((node.data.outsideCaptionText ?? "").trim() || (node.data.captionText ?? "").trim());
    body = `Hierarchy: ${cap || node.data.label}`.slice(0, 800);
  } else if (node.type === "container") {
    const cap = ((node.data.outsideCaptionText ?? "").trim() || (node.data.captionText ?? "").trim());
    const notes = (node.data.contextNotes ?? "").trim();
    const childCount = allNodes?.filter((n) => n.parentId === node.id).length ?? 0;
    body = [
      "Container frame",
      cap ? `Label: ${cap}` : "",
      notes ? `Group context: ${notes.slice(0, 2000)}` : "",
      `Items inside: ${childCount}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (!body) return undefined;
  if (allNodes?.length) {
    const pre = inheritedContainerContextPrefix(allNodes, node.id);
    return pre ? `${pre}${body}` : body;
  }
  return body;
}
