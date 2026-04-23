import type { Edge, Node } from "@xyflow/react";

export type IdeaStatus = "idea" | "validated" | "executing";
export type IdeaPriority = "low" | "medium" | "high";

/** Optional card styling stored on any studio node (CSS colors / border). */
export type FlowNodeChrome = {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  borderWidthPx?: number;
};

export type CaptionAlignOption = "left" | "center" | "right";
export type CaptionPlacementOption = "above" | "middle" | "below";

/** Caption / title line edited from the inspector (not on the node) for drag-first interaction. */
export type FlowNodeTextBlock = {
  captionText?: string;
  captionAlign?: CaptionAlignOption;
  captionPlacement?: CaptionPlacementOption;
};

export type IdeaNodeData = {
  title: string;
  description: string;
  tags: string[];
  status: IdeaStatus;
  priority: IdeaPriority;
} & FlowNodeChrome &
  FlowNodeTextBlock;

export type IdeaFlowNode = Node<IdeaNodeData, "idea">;

/** Basic geometry presets (not wireframe kits). */
export const BASIC_SHAPE_VARIANTS = [
  "rectangle",
  "rectangle_rounded",
  "square",
  "square_rounded",
  "ellipse",
  "circle",
  "diamond",
  "triangle",
] as const;

export type ShapeVariant = (typeof BASIC_SHAPE_VARIANTS)[number];

export function isBasicShapeVariant(v: string): v is ShapeVariant {
  return (BASIC_SHAPE_VARIANTS as readonly string[]).includes(v);
}

/** Basic geometry vs wireframe stencil kits. */
export type StencilLibrary = "basic" | "wireframe_backend" | "wireframe_frontend";

export type ShapeNodeData = {
  stencilLibrary: StencilLibrary;
  variant: ShapeVariant;
  /** Legacy body HTML; basic shapes use plain `captionText` + studio sidebar. */
  html: string;
  /** Wireframe preset id (see `wireframePresets.ts`). */
  presetId?: string;
  /** Wireframe label (API); kept in sync with `captionText` when editing from the sidebar. */
  caption?: string;
} & FlowNodeChrome &
  FlowNodeTextBlock;

export type ShapeFlowNode = Node<ShapeNodeData, "shape">;

export type TextNodeData = {
  html: string;
} & FlowNodeChrome &
  FlowNodeTextBlock;

export type TextFlowNode = Node<TextNodeData, "text">;

export type HierarchyNodeData = {
  label: string;
} & FlowNodeChrome &
  FlowNodeTextBlock;

export type HierarchyFlowNode = Node<HierarchyNodeData, "hierarchy">;

export type ImageNodeData = {
  /** Data URL or HTTPS URL. */
  src: string;
  alt?: string;
} & FlowNodeChrome &
  FlowNodeTextBlock;

export type ImageFlowNode = Node<ImageNodeData, "image">;

export type TableNodeData = {
  /** Rectangular string grid; persisted in DB payload. */
  rows: string[][];
  /** Relative column sizes (fr weights); length matches column count. */
  colWidths?: number[];
  /** Relative row sizes (fr weights); length matches row count. */
  rowHeights?: number[];
} & FlowNodeChrome &
  FlowNodeTextBlock;

export type TableFlowNode = Node<TableNodeData, "table">;

/** All nodes allowed on the Brainstorm Studio canvas. */
export type BrainstormFlowNode =
  | IdeaFlowNode
  | ShapeFlowNode
  | TextFlowNode
  | HierarchyFlowNode
  | ImageFlowNode
  | TableFlowNode;

export type LineStyle = "solid" | "solid_bold" | "dotted";

export type BrainstormEdgeData = {
  lineStyle?: LineStyle;
  /** Short caption drawn on the link (e.g. hierarchy / lateral link). */
  label?: string;
};

export type BrainstormEdge = Edge<BrainstormEdgeData>;

export type IdeaNodeDataPatch = Partial<IdeaNodeData>;

export function defaultIdeaData(): IdeaNodeData {
  return {
    title: "New idea",
    description: "",
    tags: [],
    status: "idea",
    priority: "medium",
    captionText: "",
    captionAlign: "left",
    captionPlacement: "below",
  };
}

export function defaultShapeData(): ShapeNodeData {
  return {
    stencilLibrary: "basic",
    variant: "rectangle",
    html: "<p></p>",
    captionText: "",
    captionAlign: "left",
    captionPlacement: "below",
  };
}

export function defaultTextData(): TextNodeData {
  return {
    html: "<p>New text</p>",
    captionText: "New text",
    captionAlign: "left",
    captionPlacement: "below",
  };
}

export function defaultHierarchyData(): HierarchyNodeData {
  return {
    label: "Branch",
    captionText: "",
    captionAlign: "left",
    captionPlacement: "below",
  };
}

export function defaultImageData(): ImageNodeData {
  return {
    src: "",
    alt: "",
    captionText: "",
    captionAlign: "left",
    captionPlacement: "below",
  };
}

export function defaultTableData(): TableNodeData {
  const rows = [
    ["", "", ""],
    ["", "", ""],
    ["", "", ""],
  ];
  const c = rows[0]!.length;
  const r = rows.length;
  return {
    rows,
    colWidths: Array.from({ length: c }, () => 1),
    rowHeights: Array.from({ length: r }, () => 1),
    captionText: "",
    captionAlign: "left",
    captionPlacement: "below",
  };
}

export type SerializedCanvas = {
  nodes: BrainstormFlowNode[];
  edges: BrainstormEdge[];
};

export function isIdeaNode(n: BrainstormFlowNode): n is IdeaFlowNode {
  return n.type === "idea";
}
