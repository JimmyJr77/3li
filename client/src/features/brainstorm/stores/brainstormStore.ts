import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import type {
  BrainstormEdge,
  BrainstormEdgeData,
  BrainstormFlowNode,
  CaptionAlignOption,
  CaptionPlacementOption,
  HierarchyFlowNode,
  IdeaFlowNode,
  IdeaNodeDataPatch,
  ImageFlowNode,
  LineStyle,
  ShapeFlowNode,
  ShapeNodeData,
  TableFlowNode,
  TextFlowNode,
} from "@/features/brainstorm/types";
import {
  defaultHierarchyData,
  defaultIdeaData,
  defaultImageData,
  defaultShapeData,
  defaultTableData,
  defaultTextData,
  isBasicShapeVariant,
  isIdeaNode,
  type IdeaNodeData,
  type ImageNodeData,
  type TableNodeData,
} from "@/features/brainstorm/types";
import {
  ancestorDepth,
  applyZReorderToNodes,
  groupSelectionIntoShape,
  organizeNodesVerticalByType,
  sortParentBeforeChildren,
  ungroupShape,
  type ZReorderOp,
} from "@/features/brainstorm/utils/nodeLayout";
import { plainTextToStudioHtml, stripHtmlToPlain } from "@/features/brainstorm/utils/studioText";
import { defaultPresetIdForLibrary } from "@/features/brainstorm/wireframePresets";

export type ThinkingMode = "divergent" | "convergent" | "strategic" | "execution";

function mergeShapeNodeData(partial?: Partial<ShapeNodeData>): ShapeNodeData {
  const base = defaultShapeData();
  const merged: ShapeNodeData = { ...base, ...partial };
  if (merged.stencilLibrary === "wireframe_backend" || merged.stencilLibrary === "wireframe_frontend") {
    const lib = merged.stencilLibrary;
    merged.presetId = (typeof merged.presetId === "string" && merged.presetId.trim()
      ? merged.presetId.trim()
      : defaultPresetIdForLibrary(lib)) as string;
    merged.caption = typeof merged.caption === "string" ? merged.caption : "";
    if (!merged.captionText?.trim() && merged.caption) {
      merged.captionText = merged.caption;
    }
  } else {
    merged.stencilLibrary = "basic";
    merged.presetId = undefined;
    merged.caption = undefined;
    if (!isBasicShapeVariant(merged.variant)) {
      merged.variant = "rectangle";
    }
    if (!merged.captionText?.trim() && typeof merged.html === "string") {
      const plain = stripHtmlToPlain(merged.html);
      if (plain) merged.captionText = plain;
    }
    merged.html = plainTextToStudioHtml(merged.captionText ?? "");
  }
  return merged;
}

function alignDefault(v: unknown, fallback: CaptionAlignOption): CaptionAlignOption {
  return v === "center" || v === "right" ? v : fallback;
}

function placementDefault(v: unknown, fallback: CaptionPlacementOption): CaptionPlacementOption {
  return v === "above" || v === "middle" ? v : fallback;
}

/** Normalize persisted / API nodes so sidebar captions and plain text bodies stay in sync. */
export function normalizeBrainstormNode(n: BrainstormFlowNode): BrainstormFlowNode {
  switch (n.type) {
    case "shape":
      return { ...n, data: mergeShapeNodeData(n.data) };
    case "hierarchy": {
      const merged = { ...defaultHierarchyData(), ...n.data };
      const cap = String(merged.captionText ?? "").trim();
      const lab = String(merged.label ?? "").trim();
      if (!cap && lab) merged.captionText = merged.label;
      if (!lab && cap) merged.label = merged.captionText ?? "";
      merged.captionAlign = alignDefault(merged.captionAlign, "left");
      merged.captionPlacement = placementDefault(merged.captionPlacement, "below");
      return { ...n, data: merged };
    }
    case "text": {
      const d = { ...n.data };
      if (!String(d.captionText ?? "").trim() && typeof d.html === "string") {
        const plain = stripHtmlToPlain(d.html);
        if (plain) d.captionText = plain;
      }
      d.html = plainTextToStudioHtml(String(d.captionText ?? ""));
      d.captionAlign = alignDefault(d.captionAlign, "left");
      d.captionPlacement = placementDefault(d.captionPlacement, "below");
      return { ...n, data: d };
    }
    case "idea": {
      const d = { ...n.data } as IdeaNodeData;
      if (typeof d.captionText !== "string") d.captionText = "";
      d.captionAlign = alignDefault(d.captionAlign, "left");
      d.captionPlacement = placementDefault(d.captionPlacement, "below");
      return { ...n, data: d };
    }
    case "image": {
      const d = { ...n.data } as ImageNodeData;
      if (typeof d.captionText !== "string") d.captionText = "";
      d.captionAlign = alignDefault(d.captionAlign, "left");
      d.captionPlacement = placementDefault(d.captionPlacement, "below");
      return { ...n, data: d };
    }
    case "table": {
      const d = { ...n.data } as TableNodeData;
      if (typeof d.captionText !== "string") d.captionText = "";
      d.captionAlign = alignDefault(d.captionAlign, "left");
      d.captionPlacement = placementDefault(d.captionPlacement, "below");
      return { ...n, data: d };
    }
    default:
      return n;
  }
}

/** After removals, drop nested nodes whose parent is gone and prune edges that reference missing nodes. */
function computeNextGraph(
  prevNodes: BrainstormFlowNode[],
  prevEdges: BrainstormEdge[],
  changes: NodeChange<BrainstormFlowNode>[],
): { nodes: BrainstormFlowNode[]; edges: BrainstormEdge[] } {
  let next = applyNodeChanges(changes, prevNodes);
  let prunedOrphans = true;
  while (prunedOrphans) {
    prunedOrphans = false;
    const ids = new Set(next.map((n) => n.id));
    const orphan = next.find((n) => n.parentId && !ids.has(n.parentId));
    if (orphan) {
      next = next.filter((n) => n.id !== orphan.id);
      prunedOrphans = true;
    }
  }
  const ids = new Set(next.map((n) => n.id));
  const edges = prevEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
  return { nodes: sortParentBeforeChildren(next), edges };
}

/** Vertical hierarchy links (parent bottom → child top). Lateral handles are excluded from branch traversal. */
function isTreeHierarchyEdge(e: BrainstormEdge): boolean {
  const sh = e.sourceHandle ?? "";
  const th = e.targetHandle ?? "";
  if (!sh && !th) return true;
  return sh === "out" && th === "in";
}

function collectDescendants(rootId: string, edges: BrainstormEdge[]): Set<string> {
  const children = new Map<string, string[]>();
  for (const e of edges) {
    if (!isTreeHierarchyEdge(e)) continue;
    const arr = children.get(e.source) ?? [];
    arr.push(e.target);
    children.set(e.source, arr);
  }
  const out = new Set<string>();
  const stack = [...(children.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const c of children.get(id) ?? []) {
      stack.push(c);
    }
  }
  return out;
}

type BrainstormState = {
  thinkingMode: ThinkingMode;
  nodes: BrainstormFlowNode[];
  edges: BrainstormEdge[];
  presentationMode: boolean;
  agentsPanelVisible: boolean;
  /** Shape tool: side panel to pick stencil before placing a node. */
  shapePickerOpen: boolean;
  selectedEdgeId: string | null;
  setThinkingMode: (mode: ThinkingMode) => void;
  setNodes: (nodes: BrainstormFlowNode[]) => void;
  setEdges: (edges: BrainstormEdge[]) => void;
  onNodesChange: (changes: NodeChange<BrainstormFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addIdeaNode: (position?: { x: number; y: number }) => void;
  addShapeNode: (opts?: { position?: { x: number; y: number }; data?: Partial<ShapeNodeData> }) => void;
  setShapePickerOpen: (open: boolean) => void;
  addImageNode: (opts: {
    position?: { x: number; y: number };
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  }) => void;
  addTableNode: (position?: { x: number; y: number }) => void;
  addTextNode: (opts?: { position?: { x: number; y: number }; parentId?: string }) => void;
  addTextFromToolbar: () => void;
  addHierarchyNode: (position?: { x: number; y: number }) => void;
  addHierarchyChild: (parentId: string) => void;
  deleteHierarchyBranch: (nodeId: string) => void;
  updateIdeaData: (id: string, patch: IdeaNodeDataPatch) => void;
  patchNodeData: (id: string, partial: Record<string, unknown>) => void;
  setEdgeLineStyle: (edgeId: string, lineStyle: LineStyle) => void;
  patchEdgeData: (edgeId: string, partial: Partial<BrainstormEdgeData>) => void;
  removeEdge: (edgeId: string) => void;
  setPresentationMode: (v: boolean) => void;
  togglePresentationMode: () => void;
  setAgentsPanelVisible: (v: boolean) => void;
  setSelectedEdgeId: (id: string | null) => void;
  resetCanvas: (nodes: BrainstormFlowNode[], edges: BrainstormEdge[]) => void;
  groupSelectedNodes: () => void;
  ungroupSelection: () => void;
  organizeSelectedNodes: () => void;
  selectSingleNode: (id: string) => void;
  clearNodeSelection: () => void;
  deleteSelectedNodes: () => void;
  duplicateSelectedNode: () => void;
  reorderSelectedZIndex: (op: ZReorderOp) => void;
};

function nextPresentationFlags(
  wasPresentation: boolean,
  nextPresentation: boolean,
): Partial<Pick<BrainstormState, "presentationMode">> {
  if (nextPresentation && !wasPresentation) {
    return { presentationMode: true };
  }
  if (!nextPresentation) {
    return { presentationMode: false };
  }
  return {};
}

export const useBrainstormStore = create<BrainstormState>((set, get) => ({
  thinkingMode: "divergent",
  nodes: [],
  edges: [],
  presentationMode: false,
  agentsPanelVisible: true,
  shapePickerOpen: false,
  selectedEdgeId: null,

  setThinkingMode: (thinkingMode) => set({ thinkingMode }),

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  setPresentationMode: (presentationMode) =>
    set((s) => nextPresentationFlags(s.presentationMode, presentationMode)),

  togglePresentationMode: () => set((s) => nextPresentationFlags(s.presentationMode, !s.presentationMode)),

  setAgentsPanelVisible: (agentsPanelVisible) => set({ agentsPanelVisible }),

  setSelectedEdgeId: (selectedEdgeId) => set({ selectedEdgeId }),

  setShapePickerOpen: (shapePickerOpen) =>
    set({
      shapePickerOpen,
      ...(shapePickerOpen ? { selectedEdgeId: null } : {}),
    }),

  onNodesChange: (changes) => {
    const { nodes, edges } = computeNextGraph(get().nodes, get().edges, changes);
    const sel = get().selectedEdgeId;
    const nextSel = sel && edges.some((e) => e.id === sel) ? sel : null;
    const anyNodeSelected = nodes.some((n) => n.selected);
    set({ nodes, edges, selectedEdgeId: anyNodeSelected ? null : nextSel });
  },

  selectSingleNode: (id) => {
    const nodes = get().nodes;
    const changes: NodeChange<BrainstormFlowNode>[] = nodes.map((n) => ({
      type: "select",
      id: n.id,
      selected: n.id === id,
    }));
    set({ nodes: applyNodeChanges(changes, nodes), selectedEdgeId: null });
  },

  clearNodeSelection: () => {
    const nodes = get().nodes;
    if (!nodes.some((n) => n.selected)) return;
    const changes: NodeChange<BrainstormFlowNode>[] = nodes.map((n) => ({
      type: "select",
      id: n.id,
      selected: false,
    }));
    set({ nodes: applyNodeChanges(changes, nodes) });
  },

  deleteSelectedNodes: () => {
    const ids = get().nodes.filter((n) => n.selected).map((n) => n.id);
    if (ids.length === 0) return;
    const changes = ids.map((id) => ({ type: "remove" as const, id }));
    const { nodes, edges } = computeNextGraph(get().nodes, get().edges, changes);
    const sel = get().selectedEdgeId;
    const nextSel = sel && edges.some((e) => e.id === sel) ? sel : null;
    set({ nodes, edges, selectedEdgeId: nextSel });
  },

  duplicateSelectedNode: () => {
    const sel = get().nodes.filter((n) => n.selected);
    if (sel.length !== 1) return;
    const orig = sel[0]!;
    const copy = JSON.parse(JSON.stringify(orig)) as BrainstormFlowNode;
    copy.id = crypto.randomUUID();
    copy.selected = true;
    copy.position = { x: orig.position.x + 28, y: orig.position.y + 28 };
    const others = get().nodes.map((x) => ({ ...x, selected: false }));
    set({ nodes: sortParentBeforeChildren([...others, copy]) });
  },

  reorderSelectedZIndex: (op) => {
    const ids = new Set(get().nodes.filter((n) => n.selected).map((n) => n.id));
    const next = applyZReorderToNodes(get().nodes, ids, op);
    if (next) set({ nodes: next });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(
        {
          ...connection,
          data: { lineStyle: "solid" satisfies LineStyle, label: "" },
        },
        get().edges,
      ),
    });
  },

  addIdeaNode: (position) => {
    const id = crypto.randomUUID();
    const node: IdeaFlowNode = {
      id,
      type: "idea",
      position: position ?? { x: 120 + Math.random() * 60, y: 80 + Math.random() * 60 },
      data: defaultIdeaData(),
    };
    set({ nodes: [...get().nodes, node] });
  },

  addShapeNode: (opts) => {
    const id = crypto.randomUUID();
    const data = mergeShapeNodeData(opts?.data);
    let width = 280;
    let height = 200;
    if (data.stencilLibrary === "basic") {
      const v = data.variant;
      if (v === "square" || v === "square_rounded" || v === "circle") {
        width = 200;
        height = 200;
      }
    }
    const node: ShapeFlowNode = {
      id,
      type: "shape",
      position: opts?.position ?? { x: 100 + Math.random() * 40, y: 100 + Math.random() * 40 },
      width,
      height,
      data,
      selected: true,
    };
    const others = get().nodes.map((n) => ({ ...n, selected: false }));
    set({
      nodes: sortParentBeforeChildren([...others, node]),
      shapePickerOpen: false,
    });
  },

  addImageNode: (opts) => {
    const id = crypto.randomUUID();
    const node: ImageFlowNode = {
      id,
      type: "image",
      position: opts.position ?? { x: 100 + Math.random() * 40, y: 80 + Math.random() * 40 },
      width: opts.width ?? 240,
      height: opts.height ?? 180,
      data: { ...defaultImageData(), src: opts.src, ...(opts.alt !== undefined ? { alt: opts.alt } : {}) },
    };
    set({ nodes: [...get().nodes, node] });
  },

  addTableNode: (position) => {
    const id = crypto.randomUUID();
    const node: TableFlowNode = {
      id,
      type: "table",
      position: position ?? { x: 120 + Math.random() * 40, y: 100 + Math.random() * 40 },
      width: 360,
      height: 220,
      data: defaultTableData(),
    };
    set({ nodes: [...get().nodes, node] });
  },

  addTextNode: (opts) => {
    const id = crypto.randomUUID();
    const pos = opts?.position ?? { x: 140 + Math.random() * 40, y: 120 + Math.random() * 40 };
    const parentId = opts?.parentId;
    const node: TextFlowNode = {
      id,
      type: "text",
      position: pos,
      ...(parentId ? { parentId, extent: "parent" as const, width: 200, height: 120 } : {}),
      /* Root text nodes: omit width/height so React Flow measures the DOM (toolbar on/off changes height). */
      data: defaultTextData(),
    };
    set({ nodes: [...get().nodes, node] });
  },

  addTextFromToolbar: () => {
    const sel = get().nodes.find((n) => n.selected);
    const parentId = sel?.type === "shape" ? sel.id : undefined;
    get().addTextNode({
      parentId,
      position: parentId ? { x: 20, y: 52 } : undefined,
    });
  },

  addHierarchyNode: (position) => {
    const id = crypto.randomUUID();
    const node: HierarchyFlowNode = {
      id,
      type: "hierarchy",
      position: position ?? { x: 160 + Math.random() * 40, y: 100 + Math.random() * 40 },
      data: defaultHierarchyData(),
    };
    set({ nodes: [...get().nodes, node] });
  },

  addHierarchyChild: (parentId) => {
    const parent = get().nodes.find((n) => n.id === parentId);
    if (!parent || parent.type !== "hierarchy") return;
    const id = crypto.randomUUID();
    const child: HierarchyFlowNode = {
      id,
      type: "hierarchy",
      position: { x: parent.position.x + 40, y: parent.position.y + 120 },
      data: {
        ...defaultHierarchyData(),
        label: "New branch",
        captionText: "New branch",
      },
    };
    const edgeId = crypto.randomUUID();
    set({
      nodes: [...get().nodes, child],
      edges: [
        ...get().edges,
        {
          id: edgeId,
          source: parentId,
          target: id,
          sourceHandle: "out",
          targetHandle: "in",
          data: { lineStyle: "solid" satisfies LineStyle, label: "" },
        },
      ],
    });
  },

  deleteHierarchyBranch: (nodeId) => {
    const desc = collectDescendants(nodeId, get().edges);
    const removeIds = new Set([nodeId, ...desc]);
    set({
      nodes: get().nodes.filter((n) => !removeIds.has(n.id)),
      edges: get().edges.filter((e) => !removeIds.has(e.source) && !removeIds.has(e.target)),
    });
  },

  updateIdeaData: (id, patch) => {
    set({
      nodes: get().nodes.map((n) => {
        if (n.id !== id || !isIdeaNode(n)) return n;
        return { ...n, data: { ...n.data, ...patch } };
      }),
    });
  },

  patchNodeData: (id, partial) => {
    set({
      nodes: get().nodes.map((n) => {
        if (n.id !== id) return n;
        const base = { ...(n.data as Record<string, unknown>) };
        for (const [k, v] of Object.entries(partial)) {
          if (v === undefined) {
            delete base[k];
          } else {
            base[k] = v;
          }
        }
        return { ...n, data: base } as BrainstormFlowNode;
      }),
    });
  },

  setEdgeLineStyle: (edgeId, lineStyle) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, lineStyle } } : e,
      ),
    });
  },

  patchEdgeData: (edgeId, partial) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, ...partial } } : e,
      ),
    });
  },

  removeEdge: (edgeId) => {
    set((s) => ({
      edges: applyEdgeChanges([{ type: "remove", id: edgeId }], s.edges),
      selectedEdgeId: s.selectedEdgeId === edgeId ? null : s.selectedEdgeId,
    }));
  },

  resetCanvas: (nodes, edges) =>
    set({
      nodes,
      edges,
      selectedEdgeId: null,
      shapePickerOpen: false,
    }),

  groupSelectedNodes: () => {
    const nodes = get().nodes;
    const selectedIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    const next = groupSelectionIntoShape(nodes, selectedIds);
    if (next) set({ nodes: next });
  },

  ungroupSelection: () => {
    let nodes = get().nodes;
    const toDissolve = new Set<string>();
    for (const n of nodes) {
      if (n.type === "shape" && n.selected && nodes.some((c) => c.parentId === n.id)) {
        toDissolve.add(n.id);
      }
    }
    for (const n of nodes) {
      if (n.selected && n.parentId) {
        const p = nodes.find((x) => x.id === n.parentId);
        if (p?.type === "shape") toDissolve.add(n.parentId);
      }
    }
    if (toDissolve.size === 0) return;
    const ordered = [...toDissolve].sort((a, b) => ancestorDepth(nodes, b) - ancestorDepth(nodes, a));
    for (const id of ordered) {
      nodes = ungroupShape(nodes, id);
    }
    set({
      nodes: sortParentBeforeChildren(nodes.map((n) => ({ ...n, selected: false }))),
    });
  },

  organizeSelectedNodes: () => {
    const nodes = get().nodes;
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    const sameParent = selected.every((n) => n.parentId === selected[0]!.parentId);
    const subset = sameParent ? selected : selected.filter((n) => !n.parentId);
    if (subset.length === 0) return;
    const ids = new Set(subset.map((n) => n.id));
    const next = organizeNodesVerticalByType(nodes, ids);
    if (next) set({ nodes: next });
  },
}));
