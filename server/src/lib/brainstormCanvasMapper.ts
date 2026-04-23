import type { Prisma } from "@prisma/client";

export type LineStyle = "solid" | "solid_bold" | "dotted";

export type CanvasNodeIncoming = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  /** React Flow sub-flow parent id */
  parentId?: string | null;
  width?: number;
  height?: number;
  data: Record<string, unknown>;
};

export type CanvasEdgeIncoming = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: { lineStyle?: LineStyle; label?: string };
};

const BASIC_SHAPE_VARIANTS = [
  "rectangle",
  "rectangle_rounded",
  "square",
  "square_rounded",
  "ellipse",
  "circle",
  "diamond",
  "triangle",
] as const;

function normalizeBasicShapeVariant(raw: unknown): (typeof BASIC_SHAPE_VARIANTS)[number] {
  return typeof raw === "string" &&
    (BASIC_SHAPE_VARIANTS as readonly string[]).includes(raw)
    ? (raw as (typeof BASIC_SHAPE_VARIANTS)[number])
    : "rectangle";
}

function escapeHtmlForLegacyShape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Positive fr-weights for table row/column layout; length must match or fallback to ones. */
function normalizeFrList(raw: unknown, len: number): number[] {
  if (!Array.isArray(raw) || raw.length !== len) {
    return Array.from({ length: len }, () => 1);
  }
  return raw.map((x) => {
    const n = typeof x === "number" ? x : Number(x);
    if (!Number.isFinite(n) || n <= 0) return 1;
    return Math.min(Math.max(n, 0.08), 32);
  });
}

function normalizeLineStyle(raw: unknown): LineStyle {
  if (raw === "solid_bold" || raw === "dotted") return raw;
  return "solid";
}

function payloadChrome(p: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (typeof p.backgroundColor === "string" && p.backgroundColor.trim()) o.backgroundColor = p.backgroundColor.trim();
  if (typeof p.color === "string" && p.color.trim()) o.color = p.color.trim();
  if (typeof p.borderColor === "string" && p.borderColor.trim()) o.borderColor = p.borderColor.trim();
  if (typeof p.borderWidthPx === "number" && Number.isFinite(p.borderWidthPx) && p.borderWidthPx > 0) {
    o.borderWidthPx = Math.min(24, Math.max(1, Math.round(p.borderWidthPx)));
  }
  return o;
}

function recordChrome(d: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (typeof d.backgroundColor === "string" && d.backgroundColor.trim()) o.backgroundColor = d.backgroundColor.trim();
  if (typeof d.color === "string" && d.color.trim()) o.color = d.color.trim();
  if (typeof d.borderColor === "string" && d.borderColor.trim()) o.borderColor = d.borderColor.trim();
  if (typeof d.borderWidthPx === "number" && Number.isFinite(d.borderWidthPx) && d.borderWidthPx > 0) {
    o.borderWidthPx = Math.min(24, Math.max(1, Math.round(d.borderWidthPx)));
  }
  return o;
}

function payloadTextBlock(p: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (typeof p.captionText === "string") o.captionText = p.captionText;
  if (p.captionAlign === "left" || p.captionAlign === "center" || p.captionAlign === "right") {
    o.captionAlign = p.captionAlign;
  }
  if (p.captionVerticalAlign === "top" || p.captionVerticalAlign === "middle" || p.captionVerticalAlign === "bottom") {
    o.captionVerticalAlign = p.captionVerticalAlign;
  }
  if (typeof p.outsideCaptionText === "string") o.outsideCaptionText = p.outsideCaptionText;
  if (p.outsideCaptionAlign === "left" || p.outsideCaptionAlign === "center" || p.outsideCaptionAlign === "right") {
    o.outsideCaptionAlign = p.outsideCaptionAlign;
  }
  if (p.outsideCaptionPlacement === "above" || p.outsideCaptionPlacement === "below") {
    o.outsideCaptionPlacement = p.outsideCaptionPlacement;
  }
  if (p.captionPlacement === "middle") {
    o.captionPlacement = "inside";
  } else if (p.captionPlacement === "above" || p.captionPlacement === "inside" || p.captionPlacement === "below") {
    o.captionPlacement = p.captionPlacement;
  }
  return o;
}

function recordTextBlock(d: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (typeof d.captionText === "string") o.captionText = d.captionText;
  if (d.captionAlign === "left" || d.captionAlign === "center" || d.captionAlign === "right") {
    o.captionAlign = d.captionAlign;
  }
  if (d.captionVerticalAlign === "top" || d.captionVerticalAlign === "middle" || d.captionVerticalAlign === "bottom") {
    o.captionVerticalAlign = d.captionVerticalAlign;
  }
  if (typeof d.outsideCaptionText === "string") o.outsideCaptionText = d.outsideCaptionText;
  if (d.outsideCaptionAlign === "left" || d.outsideCaptionAlign === "center" || d.outsideCaptionAlign === "right") {
    o.outsideCaptionAlign = d.outsideCaptionAlign;
  }
  if (d.outsideCaptionPlacement === "above" || d.outsideCaptionPlacement === "below") {
    o.outsideCaptionPlacement = d.outsideCaptionPlacement;
  }
  if (d.captionPlacement === "middle") {
    o.captionPlacement = "inside";
  } else if (d.captionPlacement === "above" || d.captionPlacement === "inside" || d.captionPlacement === "below") {
    o.captionPlacement = d.captionPlacement;
  }
  return o;
}

export function edgeLineStyleFromDb(raw: string | null | undefined): LineStyle {
  if (raw === "solid_bold" || raw === "dotted") return raw;
  return "solid";
}

export function dbNodeToCanvasNode(n: {
  id: string;
  kind: string;
  payload: Prisma.JsonValue | null;
  positionX: number;
  positionY: number;
  title: string;
  description: string;
  tags: string[];
  status: string;
  priority: string;
}): Record<string, unknown> {
  const kind = n.kind && n.kind.length > 0 ? n.kind : "idea";
  if (kind === "idea") {
    const p =
      typeof n.payload === "object" && n.payload !== null && !Array.isArray(n.payload)
        ? (n.payload as Record<string, unknown>)
        : {};
    const parentId = typeof p.parentId === "string" ? p.parentId : undefined;
    const width = typeof p.width === "number" ? p.width : undefined;
    const height = typeof p.height === "number" ? p.height : undefined;
    return {
      id: n.id,
      type: "idea",
      position: { x: n.positionX, y: n.positionY },
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      data: {
        title: n.title,
        description: n.description,
        tags: n.tags,
        status: n.status,
        priority: n.priority,
        ...payloadChrome(p),
        ...payloadTextBlock(p),
      },
    };
  }

  const p =
    typeof n.payload === "object" && n.payload !== null && !Array.isArray(n.payload)
      ? (n.payload as Record<string, unknown>)
      : {};

  const parentId = typeof p.parentId === "string" ? p.parentId : undefined;
  const width = typeof p.width === "number" ? p.width : undefined;
  const height = typeof p.height === "number" ? p.height : undefined;

  if (kind === "shape") {
    const variant = normalizeBasicShapeVariant(p.variant);
    let html = typeof p.html === "string" ? p.html : "";
    if (!html.trim()) {
      const legacyLabel =
        typeof p.label === "string" && p.label.trim()
          ? p.label.trim()
          : typeof n.title === "string" && n.title.trim()
            ? n.title.trim()
            : "";
      html = legacyLabel ? `<p>${escapeHtmlForLegacyShape(legacyLabel)}</p>` : "<p></p>";
    }
    const stencilLibrary =
      p.stencilLibrary === "wireframe_backend" || p.stencilLibrary === "wireframe_frontend"
        ? p.stencilLibrary
        : "basic";
    const data: Record<string, unknown> = {
      stencilLibrary,
      variant,
      html,
      ...payloadChrome(p),
      ...payloadTextBlock(p),
    };
    if (stencilLibrary !== "basic") {
      const defPreset = stencilLibrary === "wireframe_backend" ? "cloud" : "primary_button";
      data.presetId = typeof p.presetId === "string" && p.presetId.trim() ? p.presetId.trim() : defPreset;
      data.caption = typeof p.caption === "string" ? p.caption : "";
    }
    return {
      id: n.id,
      type: "shape",
      position: { x: n.positionX, y: n.positionY },
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      data,
    };
  }

  if (kind === "image") {
    const src = typeof p.src === "string" ? p.src : "";
    const alt = typeof p.alt === "string" ? p.alt : "";
    return {
      id: n.id,
      type: "image",
      position: { x: n.positionX, y: n.positionY },
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      data: { src, alt, ...payloadChrome(p), ...payloadTextBlock(p) },
    };
  }

  if (kind === "table") {
    const rowsRaw = p.rows;
    let rows: string[][] = [
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
    ];
    if (Array.isArray(rowsRaw) && rowsRaw.length > 0) {
      const parsed = rowsRaw
        .filter((r): r is unknown[] => Array.isArray(r))
        .map((r) => r.map((c) => (typeof c === "string" ? c : String(c ?? ""))));
      if (parsed.length > 0) {
        const colCount = Math.max(1, ...parsed.map((r) => r.length));
        rows = parsed.map((r) => {
          const copy = [...r];
          while (copy.length < colCount) copy.push("");
          return copy.slice(0, colCount);
        });
      }
    }
    const colCount = rows[0]?.length ?? 1;
    const rowCount = rows.length;
    const colWidths = normalizeFrList(p.colWidths, colCount);
    const rowHeights = normalizeFrList(p.rowHeights, rowCount);
    return {
      id: n.id,
      type: "table",
      position: { x: n.positionX, y: n.positionY },
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      data: { rows, colWidths, rowHeights, ...payloadChrome(p), ...payloadTextBlock(p) },
    };
  }

  if (kind === "container") {
    const contextNotes = typeof p.contextNotes === "string" ? p.contextNotes : "";
    return {
      id: n.id,
      type: "container",
      position: { x: n.positionX, y: n.positionY },
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      data: {
        contextNotes,
        ...payloadChrome(p),
        ...payloadTextBlock(p),
      },
    };
  }

  if (kind === "text") {
    const html = typeof p.html === "string" ? p.html : n.description || "";
    return {
      id: n.id,
      type: "text",
      position: { x: n.positionX, y: n.positionY },
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      data: { html, ...payloadChrome(p), ...payloadTextBlock(p) },
    };
  }

  if (kind === "hierarchy") {
    return {
      id: n.id,
      type: "hierarchy",
      position: { x: n.positionX, y: n.positionY },
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
      data: { label: n.title, ...payloadChrome(p), ...payloadTextBlock(p) },
    };
  }

  return {
    id: n.id,
    type: "idea",
    position: { x: n.positionX, y: n.positionY },
    data: {
      title: n.title,
      description: n.description,
      tags: n.tags,
      status: n.status,
      priority: n.priority,
    },
  };
}

export function dbEdgeToCanvasEdge(e: {
  id: string;
  sourceId: string;
  targetId: string;
  lineStyle: string | null;
  label?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): Record<string, unknown> {
  const lineStyle = edgeLineStyleFromDb(e.lineStyle ?? undefined);
  const label = typeof e.label === "string" ? e.label : "";
  return {
    id: e.id,
    source: e.sourceId,
    target: e.targetId,
    ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
    ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
    data: { lineStyle, label },
  };
}

export function canvasNodeToDbRow(n: CanvasNodeIncoming): {
  id: string;
  kind: string;
  payload: Prisma.InputJsonValue | null;
  positionX: number;
  positionY: number;
  title: string;
  description: string;
  tags: string[];
  status: string;
  priority: string;
} {
  const kindRaw = typeof n.type === "string" && n.type.length > 0 ? n.type : "idea";
  const kind =
    kindRaw === "shape" ||
    kindRaw === "text" ||
    kindRaw === "hierarchy" ||
    kindRaw === "image" ||
    kindRaw === "table" ||
    kindRaw === "container"
      ? kindRaw
      : "idea";

  if (kind === "idea") {
    const d = n.data;
    const title = typeof d.title === "string" ? d.title : "New idea";
    const description = typeof d.description === "string" ? d.description : "";
    const tags = Array.isArray(d.tags) ? d.tags.filter((t): t is string => typeof t === "string") : [];
    const status = typeof d.status === "string" ? d.status : "idea";
    const priority = typeof d.priority === "string" ? d.priority : "medium";
    const payload: Record<string, unknown> = {
      ...recordChrome(d as Record<string, unknown>),
      ...recordTextBlock(d as Record<string, unknown>),
    };
    if (n.parentId) {
      payload.parentId = n.parentId;
    }
    if (typeof n.width === "number") {
      payload.width = n.width;
    }
    if (typeof n.height === "number") {
      payload.height = n.height;
    }
    return {
      id: n.id,
      kind: "idea",
      payload: (Object.keys(payload).length ? payload : null) as Prisma.InputJsonValue | null,
      positionX: n.position.x,
      positionY: n.position.y,
      title,
      description,
      tags,
      status,
      priority,
    };
  }

  const d = n.data;
  const payload: Record<string, unknown> = { ...d };
  if (n.parentId) {
    payload.parentId = n.parentId;
  }
  if (typeof n.width === "number") {
    payload.width = n.width;
  }
  if (typeof n.height === "number") {
    payload.height = n.height;
  }

  if (kind === "shape") {
    const variant = normalizeBasicShapeVariant(d.variant);
    let html = typeof d.html === "string" ? d.html : "";
    if (!html.trim() && typeof d.label === "string" && d.label.trim()) {
      html = `<p>${escapeHtmlForLegacyShape(d.label.trim())}</p>`;
    }
    if (!html.trim()) {
      html = "<p></p>";
    }
    const stencilLibrary =
      d.stencilLibrary === "wireframe_backend" || d.stencilLibrary === "wireframe_frontend"
        ? d.stencilLibrary
        : "basic";
    const htmlPlain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const caption = typeof d.caption === "string" ? d.caption.trim() : "";
    const presetId = typeof d.presetId === "string" ? d.presetId.trim() : "";
    const plainTitle =
      stencilLibrary !== "basic"
        ? caption || presetId || "Wireframe"
        : htmlPlain || "Shape";
    const title = plainTitle.slice(0, 200) || "Shape";
    const shapePayload: Record<string, unknown> = {
      variant,
      html,
      stencilLibrary,
      ...recordChrome(d as Record<string, unknown>),
      ...recordTextBlock(d as Record<string, unknown>),
    };
    if (stencilLibrary !== "basic") {
      const defPreset = stencilLibrary === "wireframe_backend" ? "cloud" : "primary_button";
      shapePayload.presetId = presetId || defPreset;
      shapePayload.caption = typeof d.caption === "string" ? d.caption : "";
    }
    if (n.parentId) {
      shapePayload.parentId = n.parentId;
    }
    if (typeof n.width === "number") {
      shapePayload.width = n.width;
    }
    if (typeof n.height === "number") {
      shapePayload.height = n.height;
    }
    return {
      id: n.id,
      kind: "shape",
      payload: shapePayload as Prisma.InputJsonValue,
      positionX: n.position.x,
      positionY: n.position.y,
      title,
      description: (stencilLibrary !== "basic" ? plainTitle : htmlPlain).slice(0, 5000),
      tags: [],
      status: "idea",
      priority: "medium",
    };
  }

  if (kind === "container") {
    const caption = typeof (d as { captionText?: unknown }).captionText === "string" ? (d as { captionText: string }).captionText.trim() : "";
    const contextNotes =
      typeof (d as { contextNotes?: unknown }).contextNotes === "string" ? (d as { contextNotes: string }).contextNotes : "";
    const containerPayload: Record<string, unknown> = {
      contextNotes,
      ...recordChrome(d as Record<string, unknown>),
      ...recordTextBlock(d as Record<string, unknown>),
    };
    if (n.parentId) {
      containerPayload.parentId = n.parentId;
    }
    if (typeof n.width === "number") {
      containerPayload.width = n.width;
    }
    if (typeof n.height === "number") {
      containerPayload.height = n.height;
    }
    return {
      id: n.id,
      kind: "container",
      payload: containerPayload as Prisma.InputJsonValue,
      positionX: n.position.x,
      positionY: n.position.y,
      title: caption.slice(0, 200) || "Container",
      description: contextNotes.slice(0, 5000),
      tags: [],
      status: "idea",
      priority: "medium",
    };
  }

  if (kind === "image") {
    const src = typeof d.src === "string" ? d.src : "";
    const alt = typeof d.alt === "string" ? d.alt : "";
    const imgPayload: Record<string, unknown> = {
      src,
      alt,
      ...recordChrome(d as Record<string, unknown>),
      ...recordTextBlock(d as Record<string, unknown>),
    };
    if (n.parentId) {
      imgPayload.parentId = n.parentId;
    }
    if (typeof n.width === "number") {
      imgPayload.width = n.width;
    }
    if (typeof n.height === "number") {
      imgPayload.height = n.height;
    }
    return {
      id: n.id,
      kind: "image",
      payload: imgPayload as Prisma.InputJsonValue,
      positionX: n.position.x,
      positionY: n.position.y,
      title: "Image",
      description: alt.slice(0, 500),
      tags: [],
      status: "idea",
      priority: "medium",
    };
  }

  if (kind === "table") {
    const rowsRaw = d.rows;
    let rows: string[][] = [
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
    ];
    if (Array.isArray(rowsRaw) && rowsRaw.length > 0) {
      const parsed = rowsRaw
        .filter((r): r is unknown[] => Array.isArray(r))
        .map((r) => r.map((c) => (typeof c === "string" ? c : String(c ?? ""))));
      if (parsed.length > 0) {
        const colCount = Math.max(1, ...parsed.map((r) => r.length));
        rows = parsed.map((r) => {
          const copy = [...r];
          while (copy.length < colCount) copy.push("");
          return copy.slice(0, colCount);
        });
      }
    }
    const colCount = rows[0]?.length ?? 1;
    const rowCount = rows.length;
    const colWidths = normalizeFrList(d.colWidths, colCount);
    const rowHeights = normalizeFrList(d.rowHeights, rowCount);
    const tablePayload: Record<string, unknown> = {
      rows,
      colWidths,
      rowHeights,
      ...recordChrome(d as Record<string, unknown>),
      ...recordTextBlock(d as Record<string, unknown>),
    };
    if (n.parentId) {
      tablePayload.parentId = n.parentId;
    }
    if (typeof n.width === "number") {
      tablePayload.width = n.width;
    }
    if (typeof n.height === "number") {
      tablePayload.height = n.height;
    }
    const flat = rows.map((r) => r.join(" | ")).join(" / ");
    return {
      id: n.id,
      kind: "table",
      payload: tablePayload as Prisma.InputJsonValue,
      positionX: n.position.x,
      positionY: n.position.y,
      title: flat.replace(/\s+/g, " ").trim().slice(0, 200) || "Table",
      description: flat.slice(0, 5000),
      tags: [],
      status: "idea",
      priority: "medium",
    };
  }

  if (kind === "text") {
    const html = typeof d.html === "string" ? d.html : "";
    payload.html = html;
    return {
      id: n.id,
      kind: "text",
      payload: payload as Prisma.InputJsonValue,
      positionX: n.position.x,
      positionY: n.position.y,
      title: "Text",
      description: html.slice(0, 5000),
      tags: [],
      status: "idea",
      priority: "medium",
    };
  }

  const label = typeof d.label === "string" ? d.label : "Branch";
  return {
    id: n.id,
    kind: "hierarchy",
    payload: payload as Prisma.InputJsonValue,
    positionX: n.position.x,
    positionY: n.position.y,
    title: label.slice(0, 200),
    description: "",
    tags: [],
    status: "idea",
    priority: "medium",
  };
}

export function canvasEdgeToDbRow(e: CanvasEdgeIncoming): {
  id: string;
  sourceId: string;
  targetId: string;
  lineStyle: LineStyle;
  label: string;
  sourceHandle: string | null;
  targetHandle: string | null;
} {
  const rawLabel = typeof e.data?.label === "string" ? e.data.label : "";
  return {
    id: e.id,
    sourceId: e.source,
    targetId: e.target,
    lineStyle: normalizeLineStyle(e.data?.lineStyle),
    label: rawLabel.slice(0, 500),
    sourceHandle: typeof e.sourceHandle === "string" && e.sourceHandle.length > 0 ? e.sourceHandle : null,
    targetHandle: typeof e.targetHandle === "string" && e.targetHandle.length > 0 ? e.targetHandle : null,
  };
}
