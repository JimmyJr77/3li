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
/** @deprecated Legacy API only; migrated to inside + outside caption fields. */
export type CaptionPlacementOption = "above" | "inside" | "below";

/** Vertical alignment for text drawn inside the bordered artifact. */
export type CaptionVerticalOption = "top" | "middle" | "bottom";

/** Position of optional outside label relative to the artifact (does not affect artifact layout). */
export type OutsideCaptionPlacementOption = "above" | "below";

/** Caption / title lines edited from the inspector (not on the node) for drag-first interaction. */
export type FlowNodeTextBlock = {
  /** Text overlaid inside the bordered artifact. */
  captionText?: string;
  /** Horizontal alignment inside the artifact. */
  captionAlign?: CaptionAlignOption;
  /** Vertical alignment inside the artifact. */
  captionVerticalAlign?: CaptionVerticalOption;
  /** Optional label outside the artifact (positioned with offset; does not resize the artifact). */
  outsideCaptionText?: string;
  /** Horizontal alignment for the outside label. */
  outsideCaptionAlign?: CaptionAlignOption;
  /** Whether the outside label sits above or below the artifact. */
  outsideCaptionPlacement?: OutsideCaptionPlacementOption;
};

/** Props for `NodeCaptionWrapper` derived from persisted node data (+ optional appearance text color). */
export function nodeCaptionPropsFromData(d: FlowNodeTextBlock & Partial<Pick<FlowNodeChrome, "color">>) {
  const insideCaptionAlign: CaptionAlignOption =
    d.captionAlign === "center" || d.captionAlign === "right" ? d.captionAlign : "left";
  const insideCaptionVerticalAlign: CaptionVerticalOption =
    d.captionVerticalAlign === "top" || d.captionVerticalAlign === "bottom" ? d.captionVerticalAlign : "middle";
  const outsideCaptionAlign: CaptionAlignOption =
    d.outsideCaptionAlign === "left" || d.outsideCaptionAlign === "right" ? d.outsideCaptionAlign : "center";
  const outsideCaptionPlacement: OutsideCaptionPlacementOption =
    d.outsideCaptionPlacement === "above" ? "above" : "below";
  const insideCaptionColor =
    typeof d.color === "string" && d.color.trim() ? d.color.trim() : undefined;
  return {
    insideCaptionText: d.captionText,
    insideCaptionAlign,
    insideCaptionVerticalAlign,
    insideCaptionColor,
    outsideCaptionText: typeof d.outsideCaptionText === "string" ? d.outsideCaptionText : "",
    outsideCaptionAlign,
    outsideCaptionPlacement,
  };
}

export type IdeaNodeData = {
  title: string;
  description: string;
  tags: string[];
  status: IdeaStatus;
  priority: IdeaPriority;
} & FlowNodeChrome &
  FlowNodeTextBlock;

export type IdeaFlowNode = Node<IdeaNodeData, "idea">;

/** Flat / diagram geometry (not wireframe kits). */
export const BASIC_2D_SHAPE_VARIANTS = [
  "rectangle",
  "rectangle_rounded",
  "square",
  "square_rounded",
  "ellipse",
  "circle",
  "diamond",
  "triangle",
  "hexagon",
  "pentagon",
  "octagon",
  "star",
  "parallelogram",
] as const;

/** Stylized solids (same persistence model as 2D basics). */
export const BASIC_3D_SHAPE_VARIANTS = [
  "cube",
  "block_3d",
  "cylinder",
  "cone",
  "sphere",
  "pyramid",
] as const;

/** Basic geometry presets (2D + 3D; not wireframe kits). */
export const BASIC_SHAPE_VARIANTS = [...BASIC_2D_SHAPE_VARIANTS, ...BASIC_3D_SHAPE_VARIANTS] as const;

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
  /** Wireframe label (API); kept in sync with inside `captionText` when editing from the sidebar. */
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

/** Resizable grouping frame; children move with it and inherit LLM context. */
export type ContainerNodeData = {
  /** Extra context for models; combined with ancestor containers when summarizing descendants. */
  contextNotes?: string;
} & FlowNodeChrome &
  FlowNodeTextBlock;

export type ContainerFlowNode = Node<ContainerNodeData, "container">;

/** All nodes allowed on the Brainstorm Studio canvas. */
export type BrainstormFlowNode =
  | IdeaFlowNode
  | ShapeFlowNode
  | TextFlowNode
  | HierarchyFlowNode
  | ImageFlowNode
  | TableFlowNode
  | ContainerFlowNode;

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
    captionVerticalAlign: "middle",
    outsideCaptionText: "",
    outsideCaptionAlign: "center",
    outsideCaptionPlacement: "below",
  };
}

export function defaultShapeData(): ShapeNodeData {
  return {
    stencilLibrary: "basic",
    variant: "rectangle",
    html: "<p></p>",
    captionText: "",
    captionAlign: "left",
    captionVerticalAlign: "middle",
    outsideCaptionText: "",
    outsideCaptionAlign: "center",
    outsideCaptionPlacement: "below",
  };
}

export function defaultTextData(): TextNodeData {
  return {
    html: "<p>New text</p>",
    captionText: "",
    captionAlign: "left",
    captionVerticalAlign: "middle",
    outsideCaptionText: "New text",
    outsideCaptionAlign: "center",
    outsideCaptionPlacement: "below",
  };
}

export function defaultHierarchyData(): HierarchyNodeData {
  return {
    label: "Branch",
    captionText: "",
    captionAlign: "left",
    captionVerticalAlign: "middle",
    outsideCaptionText: "Branch",
    outsideCaptionAlign: "center",
    outsideCaptionPlacement: "below",
  };
}

export function defaultImageData(): ImageNodeData {
  return {
    src: "",
    alt: "",
    captionText: "",
    captionAlign: "left",
    captionVerticalAlign: "middle",
    outsideCaptionText: "",
    outsideCaptionAlign: "center",
    outsideCaptionPlacement: "below",
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
    captionVerticalAlign: "middle",
    outsideCaptionText: "",
    outsideCaptionAlign: "center",
    outsideCaptionPlacement: "below",
  };
}

export function defaultContainerData(): ContainerNodeData {
  return {
    contextNotes: "",
    captionText: "",
    captionAlign: "left",
    captionVerticalAlign: "middle",
    outsideCaptionText: "",
    outsideCaptionAlign: "center",
    outsideCaptionPlacement: "below",
  };
}

export type SerializedCanvas = {
  nodes: BrainstormFlowNode[];
  edges: BrainstormEdge[];
};

export function isIdeaNode(n: BrainstormFlowNode): n is IdeaFlowNode {
  return n.type === "idea";
}
