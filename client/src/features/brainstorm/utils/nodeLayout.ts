import type { BrainstormFlowNode, ShapeFlowNode } from "@/features/brainstorm/types";
import { defaultShapeData } from "@/features/brainstorm/types";

/** Approximate node dimensions for layout when RF has not measured yet. */
export function approxNodeSize(n: BrainstormFlowNode): { w: number; h: number } {
  switch (n.type) {
    case "idea":
      return { w: 260, h: 300 };
    case "shape":
      return { w: typeof n.width === "number" ? n.width : 280, h: typeof n.height === "number" ? n.height : 200 };
    case "text":
      return { w: typeof n.width === "number" ? n.width : 220, h: typeof n.height === "number" ? n.height : 100 };
    case "hierarchy":
      return { w: 168, h: 120 };
    case "image":
      return { w: typeof n.width === "number" ? n.width : 240, h: typeof n.height === "number" ? n.height : 180 };
    case "table":
      return { w: typeof n.width === "number" ? n.width : 360, h: typeof n.height === "number" ? n.height : 220 };
    default:
      return { w: 200, h: 120 };
  }
}

/** Top-left of this node in flow (absolute) coordinates. */
export function absolutePosition(nodes: BrainstormFlowNode[], id: string): { x: number; y: number } {
  const n = nodes.find((x) => x.id === id);
  if (!n) return { x: 0, y: 0 };
  let { x, y } = n.position;
  if (n.parentId) {
    const p = absolutePosition(nodes, n.parentId);
    return { x: x + p.x, y: y + p.y };
  }
  return { x, y };
}

/** Parents must appear before children in the nodes array for React Flow. */
export function sortParentBeforeChildren(nodes: BrainstormFlowNode[]): BrainstormFlowNode[] {
  const idSet = new Set(nodes.map((n) => n.id));
  const byParent = new Map<string, BrainstormFlowNode[]>();
  for (const n of nodes) {
    const p = n.parentId && idSet.has(n.parentId) ? n.parentId : "__ROOT__";
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(n);
  }
  const out: BrainstormFlowNode[] = [];
  function visit(parentKey: string) {
    for (const n of byParent.get(parentKey) ?? []) {
      out.push(n);
      visit(n.id);
    }
  }
  visit("__ROOT__");
  return out;
}

const TYPE_ORDER: Record<BrainstormFlowNode["type"], number> = {
  idea: 0,
  shape: 1,
  table: 2,
  text: 3,
  image: 4,
  hierarchy: 5,
};

export function sortNodesByTypeThenId(a: BrainstormFlowNode, b: BrainstormFlowNode): number {
  const td = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  if (td !== 0) return td;
  return a.id.localeCompare(b.id);
}

export function ancestorDepth(nodes: BrainstormFlowNode[], id: string): number {
  let d = 0;
  let cur = nodes.find((x) => x.id === id);
  while (cur?.parentId) {
    d += 1;
    cur = nodes.find((x) => x.id === cur!.parentId!);
  }
  return d;
}

function stripParent(node: BrainstormFlowNode, position: { x: number; y: number }): BrainstormFlowNode {
  const draft = { ...node, position } as Record<string, unknown>;
  delete draft.parentId;
  delete draft.extent;
  return draft as BrainstormFlowNode;
}

/** Remove a shape frame and keep children (reparent to the shape's parent, or root). */
export function ungroupShape(nodes: BrainstormFlowNode[], shapeId: string): BrainstormFlowNode[] {
  const shape = nodes.find((n) => n.id === shapeId && n.type === "shape");
  if (!shape) return nodes;
  const children = nodes.filter((n) => n.parentId === shapeId);
  const others = nodes.filter((n) => n.id !== shapeId && n.parentId !== shapeId);
  if (children.length === 0) {
    return nodes.filter((n) => n.id !== shapeId);
  }
  const parentOfShape = shape.parentId;
  const parentAbs = parentOfShape ? absolutePosition(nodes, parentOfShape) : { x: 0, y: 0 };
  const newChildren = children.map((child) => {
    const cAbs = absolutePosition(nodes, child.id);
    if (parentOfShape) {
      return {
        ...child,
        parentId: parentOfShape,
        extent: "parent" as const,
        position: { x: cAbs.x - parentAbs.x, y: cAbs.y - parentAbs.y },
      } as BrainstormFlowNode;
    }
    return stripParent(child, cAbs);
  });
  return [...others, ...newChildren];
}

/** Wrap all selected nodes in a new shape (React Flow parent). Returns null if grouping is invalid. */
export function groupSelectionIntoShape(
  nodes: BrainstormFlowNode[],
  selectedIds: Set<string>,
): BrainstormFlowNode[] | null {
  const selected = nodes.filter((n) => selectedIds.has(n.id));
  if (selected.length < 2) return null;

  const pad = 28;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of selected) {
    const abs = absolutePosition(nodes, n.id);
    const { w, h } = approxNodeSize(n);
    minX = Math.min(minX, abs.x);
    minY = Math.min(minY, abs.y);
    maxX = Math.max(maxX, abs.x + w);
    maxY = Math.max(maxY, abs.y + h);
  }
  const gx = minX - pad;
  const gy = minY - pad;
  const gw = Math.max(maxX - minX + pad * 2, 160);
  const gh = Math.max(maxY - minY + pad * 2, 120);
  const groupId = crypto.randomUUID();

  const newShape: ShapeFlowNode = {
    id: groupId,
    type: "shape",
    position: { x: gx, y: gy },
    width: gw,
    height: gh,
    data: defaultShapeData(),
    selected: true,
  };

  const others = nodes.filter((n) => !selectedIds.has(n.id)).map((n) => ({ ...n, selected: false }));
  const reparented = selected.map((n) => {
    const abs = absolutePosition(nodes, n.id);
    return {
      ...n,
      parentId: groupId,
      extent: "parent" as const,
      position: { x: abs.x - gx, y: abs.y - gy },
      selected: false,
    } as BrainstormFlowNode;
  });

  return sortParentBeforeChildren([...others, newShape, ...reparented]);
}

/** Stack selected nodes vertically, ordered idea → shape → text → hierarchy. */
export function organizeNodesVerticalByType(
  nodes: BrainstormFlowNode[],
  movingIds: Set<string>,
): BrainstormFlowNode[] | null {
  const moving = nodes.filter((n) => movingIds.has(n.id));
  if (moving.length === 0) return null;
  const parentId = moving[0]!.parentId;
  if (!moving.every((n) => n.parentId === parentId)) return null;

  const sorted = [...moving].sort(sortNodesByTypeThenId);
  const gap = 20;
  const positions = new Map<string, { x: number; y: number }>();

  if (parentId) {
    let y = 52;
    for (const n of sorted) {
      const { h } = approxNodeSize(n);
      positions.set(n.id, { x: 24, y });
      y += h + gap;
    }
  } else {
    const minX = Math.min(...sorted.map((n) => absolutePosition(nodes, n.id).x));
    const minY = Math.min(...sorted.map((n) => absolutePosition(nodes, n.id).y));
    let y = minY;
    for (const n of sorted) {
      const { h } = approxNodeSize(n);
      positions.set(n.id, { x: minX, y });
      y += h + gap;
    }
  }

  return nodes.map((n) => {
    if (!movingIds.has(n.id)) return n;
    const pos = positions.get(n.id);
    if (!pos) return n;
    return { ...n, position: pos };
  });
}

/** Z-order among siblings (same `parentId` / root) follows DFS order from `sortParentBeforeChildren`. */
export function collectSiblingsByParent(sorted: BrainstormFlowNode[]): Map<string, BrainstormFlowNode[]> {
  const idSet = new Set(sorted.map((n) => n.id));
  const byParent = new Map<string, BrainstormFlowNode[]>();
  for (const n of sorted) {
    const pk = n.parentId && idSet.has(n.parentId) ? n.parentId : "__ROOT__";
    if (!byParent.has(pk)) byParent.set(pk, []);
    byParent.get(pk)!.push(n);
  }
  return byParent;
}

export function flattenFromByParent(byParent: Map<string, BrainstormFlowNode[]>): BrainstormFlowNode[] {
  const out: BrainstormFlowNode[] = [];
  function visit(pk: string) {
    for (const n of byParent.get(pk) ?? []) {
      out.push(n);
      visit(n.id);
    }
  }
  visit("__ROOT__");
  return out;
}

export type ZReorderOp = "forward" | "backward" | "front" | "back";

/** One step toward front among siblings (rightmost movable selected block). */
function bringForwardBlocksRtl(sibs: BrainstormFlowNode[], selected: Set<string>): BrainstormFlowNode[] {
  const work = [...sibs];
  let i = work.length - 1;
  while (i >= 0) {
    if (!selected.has(work[i]!.id)) {
      i--;
      continue;
    }
    const end = i + 1;
    while (i >= 0 && selected.has(work[i]!.id)) i--;
    const start = i + 1;
    if (end < work.length) {
      const block = work.slice(start, end);
      const next = work[end]!;
      const before = work.slice(0, start);
      const after = work.slice(end + 1);
      return [...before, next, ...block, ...after];
    }
  }
  return work;
}

/** One step toward back among siblings (leftmost movable selected block). */
function sendBackwardBlocksLtr(sibs: BrainstormFlowNode[], selected: Set<string>): BrainstormFlowNode[] {
  const work = [...sibs];
  let i = 0;
  while (i < work.length) {
    if (!selected.has(work[i]!.id)) {
      i++;
      continue;
    }
    const start = i;
    while (i < work.length && selected.has(work[i]!.id)) i++;
    const end = i;
    if (start > 0) {
      const prev = work[start - 1]!;
      const block = work.slice(start, end);
      const before = work.slice(0, start - 1);
      const after = work.slice(end);
      return [...before, ...block, prev, ...after];
    }
  }
  return work;
}

function reorderSiblingsForOp(sibs: BrainstormFlowNode[], selected: Set<string>, op: ZReorderOp): BrainstormFlowNode[] {
  switch (op) {
    case "front": {
      const sel = sibs.filter((n) => selected.has(n.id));
      const unsel = sibs.filter((n) => !selected.has(n.id));
      return [...unsel, ...sel];
    }
    case "back": {
      const sel = sibs.filter((n) => selected.has(n.id));
      const unsel = sibs.filter((n) => !selected.has(n.id));
      return [...sel, ...unsel];
    }
    case "forward":
      return bringForwardBlocksRtl(sibs, selected);
    case "backward":
      return sendBackwardBlocksLtr(sibs, selected);
    default:
      return sibs;
  }
}

/** Returns a new node list if z-order changes, otherwise `null`. */
export function applyZReorderToNodes(
  nodes: BrainstormFlowNode[],
  selectedIds: Set<string>,
  op: ZReorderOp,
): BrainstormFlowNode[] | null {
  if (selectedIds.size === 0) return null;
  const sorted = sortParentBeforeChildren(nodes);
  const byParent = collectSiblingsByParent(sorted);
  const clone = new Map<string, BrainstormFlowNode[]>();
  for (const [k, v] of byParent) clone.set(k, [...v]);

  const idSet = new Set(sorted.map((n) => n.id));
  const touchedParents = new Set<string>();
  for (const id of selectedIds) {
    const n = sorted.find((x) => x.id === id);
    if (!n) continue;
    const pk = n.parentId && idSet.has(n.parentId) ? n.parentId : "__ROOT__";
    touchedParents.add(pk);
  }

  let changed = false;
  for (const pk of touchedParents) {
    const prev = clone.get(pk) ?? [];
    const next = reorderSiblingsForOp(prev, selectedIds, op);
    if (next.length !== prev.length || next.some((n, i) => n.id !== prev[i]!.id)) {
      changed = true;
      clone.set(pk, next);
    }
  }
  if (!changed) return null;
  return flattenFromByParent(clone);
}

export function zReorderWouldChange(
  nodes: BrainstormFlowNode[],
  selectedIds: Set<string>,
  op: ZReorderOp,
): boolean {
  return applyZReorderToNodes(nodes, selectedIds, op) !== null;
}
