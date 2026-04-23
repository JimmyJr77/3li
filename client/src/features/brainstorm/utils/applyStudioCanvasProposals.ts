import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import type { BrainstormFlowNode } from "@/features/brainstorm/types";
import type { StudioCanvasProposalItem } from "@/features/brainstorm/utils/parseStudioCanvasProposal";

function roughCanvasBottom(nodes: BrainstormFlowNode[]): number {
  let maxBottom = 72;
  for (const n of nodes) {
    const h = typeof n.height === "number" && Number.isFinite(n.height) ? n.height : 140;
    const bottom = n.position.y + h;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return maxBottom;
}

/**
 * Places proposal nodes in a simple grid below existing content.
 */
export function applyStudioCanvasProposals(proposals: StudioCanvasProposalItem[]): number {
  if (proposals.length === 0) return 0;
  const store = useBrainstormStore.getState();
  const nodes = store.nodes;
  const startY = roughCanvasBottom(nodes) + 48;
  const colW = 300;
  const rowH = 170;
  const cols = 3;
  let placed = 0;
  let idx = 0;
  for (const p of proposals) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = 72 + col * colW;
    const y = startY + row * rowH;
    if (p.type === "idea") {
      store.addIdeaWithContent({ title: p.title, description: p.description }, { x, y });
      placed++;
    } else {
      store.addTextWithPlain(p.text, { x, y });
      placed++;
    }
    idx++;
  }
  return placed;
}
