import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDownFromLine,
  ArrowUpFromLine,
  Copy,
  GitBranch,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import type {
  BrainstormFlowNode,
  CaptionAlignOption,
  CaptionVerticalOption,
  FlowNodeChrome,
  HierarchyFlowNode,
  IdeaFlowNode,
  ContainerFlowNode,
  ImageFlowNode,
  OutsideCaptionPlacementOption,
  ShapeFlowNode,
  TableFlowNode,
} from "@/features/brainstorm/types";
import { isIdeaNode } from "@/features/brainstorm/types";
import { plainTextToStudioHtml } from "@/features/brainstorm/utils/studioText";
import { presetsForWireframeLibrary, type WireframeLibrary } from "@/features/brainstorm/wireframePresets";

const BORDER_WIDTHS = [1, 2, 3, 4, 5, 6, 8] as const;
const ideaStatuses = ["idea", "validated", "executing"] as const;
const ideaPriorities = ["low", "medium", "high"] as const;
const MIN_FR = 0.12;

function chromeFromData(data: Record<string, unknown>): Partial<FlowNodeChrome> {
  return {
    backgroundColor: typeof data.backgroundColor === "string" ? data.backgroundColor : undefined,
    color: typeof data.color === "string" ? data.color : undefined,
    borderColor: typeof data.borderColor === "string" ? data.borderColor : undefined,
    borderWidthPx: typeof data.borderWidthPx === "number" ? data.borderWidthPx : undefined,
  };
}

function AppearanceSection({ nodeId, data }: { nodeId: string; data: Record<string, unknown> }) {
  const patchNodeData = useBrainstormStore((s) => s.patchNodeData);
  const c = chromeFromData(data);
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Appearance</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Background</Label>
          <Input
            type="color"
            className="nodrag nopan h-8 cursor-pointer p-0.5"
            value={c.backgroundColor ?? "#ffffff"}
            onChange={(e) => patchNodeData(nodeId, { backgroundColor: e.target.value })}
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Text</Label>
          <Input
            type="color"
            className="nodrag nopan h-8 cursor-pointer p-0.5"
            value={c.color ?? "#0a0a0a"}
            onChange={(e) => patchNodeData(nodeId, { color: e.target.value })}
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Outline</Label>
          <Input
            type="color"
            className="nodrag nopan h-8 cursor-pointer p-0.5"
            value={c.borderColor ?? "#e5e5e5"}
            onChange={(e) => patchNodeData(nodeId, { borderColor: e.target.value })}
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Outline width</Label>
          <select
            className="nodrag nopan h-8 w-full rounded-md border border-input bg-background px-1 text-xs"
            value={c.borderWidthPx ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              patchNodeData(nodeId, { borderWidthPx: v === "" ? undefined : Number(v) });
            }}
          >
            <option value="">Default</option>
            {BORDER_WIDTHS.map((w) => (
              <option key={w} value={w}>
                {w}px
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="nodrag nopan h-7 w-full text-[10px] text-muted-foreground"
        onClick={() =>
          patchNodeData(nodeId, {
            backgroundColor: undefined,
            color: undefined,
            borderColor: undefined,
            borderWidthPx: undefined,
          })
        }
      >
        Reset appearance
      </Button>
    </div>
  );
}

function StudioTextSection({ node }: { node: BrainstormFlowNode }) {
  const patchNodeData = useBrainstormStore((s) => s.patchNodeData);
  const d = node.data as Record<string, unknown>;
  const captionText = typeof d.captionText === "string" ? d.captionText : "";
  const rawOutside = typeof d.outsideCaptionText === "string" ? d.outsideCaptionText : "";
  const hierarchyLabel = node.type === "hierarchy" ? String((node as HierarchyFlowNode).data.label ?? "") : "";
  const outsideCaptionText =
    node.type === "hierarchy" ? rawOutside || hierarchyLabel : rawOutside;
  const captionAlign = (d.captionAlign === "center" || d.captionAlign === "right" ? d.captionAlign : "left") as CaptionAlignOption;
  const captionVerticalAlign = (
    d.captionVerticalAlign === "top" || d.captionVerticalAlign === "bottom" ? d.captionVerticalAlign : "middle"
  ) as CaptionVerticalOption;
  const outsideCaptionAlign = (
    d.outsideCaptionAlign === "left" || d.outsideCaptionAlign === "right" ? d.outsideCaptionAlign : "center"
  ) as CaptionAlignOption;
  const outsideCaptionPlacement = (d.outsideCaptionPlacement === "above" ? "above" : "below") as OutsideCaptionPlacementOption;

  const applyInsideCaption = useCallback(
    (next: string) => {
      const patch: Record<string, unknown> = { captionText: next };
      if (node.type === "text") {
        patch.html = plainTextToStudioHtml(next);
      }
      if (node.type === "shape") {
        const lib = (node as ShapeFlowNode).data.stencilLibrary;
        if (lib === "wireframe_backend" || lib === "wireframe_frontend") {
          patch.caption = next;
        }
      }
      patchNodeData(node.id, patch);
    },
    [node.id, node.type, patchNodeData],
  );

  const applyOutsideCaption = useCallback(
    (next: string) => {
      const patch: Record<string, unknown> = { outsideCaptionText: next };
      if (node.type === "hierarchy") {
        patch.label = next;
      }
      patchNodeData(node.id, patch);
    },
    [node.id, node.type, patchNodeData],
  );

  const setInsideH = (captionAlign: CaptionAlignOption) => patchNodeData(node.id, { captionAlign });
  const setInsideV = (captionVerticalAlign: CaptionVerticalOption) => patchNodeData(node.id, { captionVerticalAlign });
  const setOutsideH = (outsideCaptionAlign: CaptionAlignOption) => patchNodeData(node.id, { outsideCaptionAlign });
  const setOutsideV = (outsideCaptionPlacement: OutsideCaptionPlacementOption) =>
    patchNodeData(node.id, { outsideCaptionPlacement });

  const iconToggle = (
    active: boolean,
    onClick: () => void,
    title: string,
    Icon: typeof AlignLeft,
  ) => (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "outline"}
      className="nodrag nopan h-8 flex-1 px-0"
      title={title}
      onClick={onClick}
    >
      <Icon className="mx-auto size-4 shrink-0" aria-hidden />
    </Button>
  );

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Text on artifact</p>
      <textarea
        className="nodrag nopan min-h-[3.5rem] w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-xs"
        value={captionText}
        placeholder="Optional text overlaid inside the frame"
        onChange={(e) => applyInsideCaption(e.target.value)}
      />
      <div className="space-y-1">
        <span className="text-[10px] text-muted-foreground">Horizontal</span>
        <div className="flex gap-1">
          {iconToggle(captionAlign === "left", () => setInsideH("left"), "Align left inside artifact", AlignLeft)}
          {iconToggle(
            captionAlign === "center",
            () => setInsideH("center"),
            "Align center inside artifact",
            AlignCenter,
          )}
          {iconToggle(captionAlign === "right", () => setInsideH("right"), "Align right inside artifact", AlignRight)}
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-[10px] text-muted-foreground">Vertical</span>
        <div className="flex gap-1">
          {iconToggle(
            captionVerticalAlign === "top",
            () => setInsideV("top"),
            "Top inside artifact",
            AlignVerticalJustifyStart,
          )}
          {iconToggle(
            captionVerticalAlign === "middle",
            () => setInsideV("middle"),
            "Middle inside artifact",
            AlignVerticalJustifyCenter,
          )}
          {iconToggle(
            captionVerticalAlign === "bottom",
            () => setInsideV("bottom"),
            "Bottom inside artifact",
            AlignVerticalJustifyEnd,
          )}
        </div>
      </div>

      <div className="border-t border-border pt-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Outside label</p>
        <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground">
          Optional; sits outside the frame with an offset and does not resize the artifact.
        </p>
        <textarea
          className="nodrag nopan min-h-[3.5rem] w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          value={outsideCaptionText}
          placeholder="Optional label outside the frame"
          onChange={(e) => applyOutsideCaption(e.target.value)}
        />
        <div className="mt-1.5 space-y-1">
          <span className="text-[10px] text-muted-foreground">Side of artifact</span>
          <div className="flex gap-1">
            {iconToggle(
              outsideCaptionPlacement === "above",
              () => setOutsideV("above"),
              "Place outside label above the artifact",
              ArrowUpFromLine,
            )}
            {iconToggle(
              outsideCaptionPlacement === "below",
              () => setOutsideV("below"),
              "Place outside label below the artifact",
              ArrowDownFromLine,
            )}
          </div>
        </div>
        <div className="mt-1.5 space-y-1">
          <span className="text-[10px] text-muted-foreground">Horizontal</span>
          <div className="flex gap-1">
            {iconToggle(
              outsideCaptionAlign === "left",
              () => setOutsideH("left"),
              "Outside label left",
              AlignLeft,
            )}
            {iconToggle(
              outsideCaptionAlign === "center",
              () => setOutsideH("center"),
              "Outside label center",
              AlignCenter,
            )}
            {iconToggle(
              outsideCaptionAlign === "right",
              () => setOutsideH("right"),
              "Outside label right",
              AlignRight,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IdeaSection({ node }: { node: IdeaFlowNode }) {
  const updateIdeaData = useBrainstormStore((s) => s.updateIdeaData);
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Idea</p>
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Title</Label>
        <Input
          className="nodrag nopan h-8 text-xs"
          value={node.data.title}
          onChange={(e) => updateIdeaData(node.id, { title: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Notes</Label>
        <textarea
          className="nodrag nopan min-h-[4rem] w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          value={node.data.description}
          onChange={(e) => updateIdeaData(node.id, { description: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Tags</Label>
        <Input
          className="nodrag nopan h-8 text-xs"
          value={node.data.tags.join(", ")}
          placeholder="comma, separated"
          onChange={(e) =>
            updateIdeaData(node.id, {
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">Status</span>
          <select
            className="nodrag nopan h-8 rounded-md border border-input bg-background px-1 text-xs"
            value={node.data.status}
            onChange={(e) =>
              updateIdeaData(node.id, { status: e.target.value as (typeof ideaStatuses)[number] })
            }
          >
            {ideaStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">Priority</span>
          <select
            className="nodrag nopan h-8 rounded-md border border-input bg-background px-1 text-xs"
            value={node.data.priority}
            onChange={(e) =>
              updateIdeaData(node.id, { priority: e.target.value as (typeof ideaPriorities)[number] })
            }
          >
            {ideaPriorities.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function HierarchySection({ node }: { node: HierarchyFlowNode }) {
  const addHierarchyChild = useBrainstormStore((s) => s.addHierarchyChild);
  const deleteHierarchyBranch = useBrainstormStore((s) => s.deleteHierarchyBranch);
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Branch</p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="nodrag nopan h-8 w-full gap-1 text-[10px]"
        onClick={() => addHierarchyChild(node.id)}
      >
        <GitBranch className="size-3.5 shrink-0" />
        Add child
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="nodrag nopan h-8 w-full gap-1 border-destructive/40 text-[10px] text-destructive hover:bg-destructive/10"
        onClick={() => {
          if (window.confirm("Delete this branch and all descendants?")) {
            deleteHierarchyBranch(node.id);
          }
        }}
      >
        <Trash2 className="size-3.5 shrink-0" />
        Delete branch
      </Button>
    </div>
  );
}

function ImageSection({ node }: { node: ImageFlowNode }) {
  const patchNodeData = useBrainstormStore((s) => s.patchNodeData);
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">Alt text</Label>
      <Input
        className="nodrag nopan h-8 text-xs"
        value={node.data.alt ?? ""}
        placeholder="Describe this image"
        onChange={(e) => patchNodeData(node.id, { alt: e.target.value })}
      />
    </div>
  );
}

function WireframePresetSection({ node }: { node: ShapeFlowNode }) {
  const patchNodeData = useBrainstormStore((s) => s.patchNodeData);
  const lib = node.data.stencilLibrary;
  if (lib !== "wireframe_backend" && lib !== "wireframe_frontend") return null;
  const wl = lib as WireframeLibrary;
  const presets = presetsForWireframeLibrary(wl);
  const pid = node.data.presetId ?? presets[0]!.id;
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">Stencil</Label>
      <select
        className="nodrag nopan h-8 w-full rounded-md border border-input bg-background px-1 text-xs"
        value={pid}
        onChange={(e) => patchNodeData(node.id, { presetId: e.target.value })}
      >
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function cloneRows(rows: string[][]): string[][] {
  return rows.map((r) => [...r]);
}

function clampFr(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 1;
  return Math.min(Math.max(x, MIN_FR), 32);
}

function ContainerContextSection({ node }: { node: ContainerFlowNode }) {
  const patchNodeData = useBrainstormStore((s) => s.patchNodeData);
  const notes = typeof node.data.contextNotes === "string" ? node.data.contextNotes : "";
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">Group context (LLM)</Label>
      <textarea
        className="nodrag nopan min-h-[4rem] w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-xs"
        value={notes}
        placeholder="Notes that apply to everything inside this container when summarizing for AI."
        onChange={(e) => patchNodeData(node.id, { contextNotes: e.target.value })}
      />
    </div>
  );
}

function TableStructureSection({ node }: { node: TableFlowNode }) {
  const patchNodeData = useBrainstormStore((s) => s.patchNodeData);
  const numCols = node.data.rows[0]?.length ?? 1;
  const numRows = node.data.rows.length;

  const colWidths = useMemo(() => {
    const w = node.data.colWidths;
    if (w && w.length === numCols) return w.map(clampFr);
    return Array.from({ length: numCols }, () => 1);
  }, [node.data.colWidths, numCols]);

  const rowHeights = useMemo(() => {
    const h = node.data.rowHeights;
    if (h && h.length === numRows) return h.map(clampFr);
    return Array.from({ length: numRows }, () => 1);
  }, [node.data.rowHeights, numRows]);

  const addRow = useCallback(() => {
    const cols = Math.max(1, node.data.rows[0]?.length ?? 1);
    const newRows = [...cloneRows(node.data.rows), Array.from({ length: cols }, () => "")];
    patchNodeData(node.id, { rows: newRows, rowHeights: [...rowHeights, 1] });
  }, [node.data.rows, node.id, patchNodeData, rowHeights]);

  const removeRow = useCallback(() => {
    if (node.data.rows.length <= 1) return;
    patchNodeData(node.id, { rows: node.data.rows.slice(0, -1), rowHeights: rowHeights.slice(0, -1) });
  }, [node.data.rows, node.id, patchNodeData, rowHeights]);

  const addCol = useCallback(() => {
    const newRows = node.data.rows.map((r) => [...r, ""]);
    patchNodeData(node.id, { rows: newRows, colWidths: [...colWidths, 1] });
  }, [colWidths, node.data.rows, node.id, patchNodeData]);

  const removeCol = useCallback(() => {
    if ((node.data.rows[0]?.length ?? 0) <= 1) return;
    patchNodeData(node.id, { rows: node.data.rows.map((r) => r.slice(0, -1)), colWidths: colWidths.slice(0, -1) });
  }, [colWidths, node.data.rows, node.id, patchNodeData]);

  const resetEvenLayout = useCallback(() => {
    const c = node.data.rows[0]?.length ?? 1;
    const r = node.data.rows.length;
    patchNodeData(node.id, {
      colWidths: Array.from({ length: c }, () => 1),
      rowHeights: Array.from({ length: r }, () => 1),
    });
  }, [node.data.rows, node.id, patchNodeData]);

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Table</p>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Click cells on the board to edit. Use these controls for rows and columns.
      </p>
      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={addRow}>
          + Row
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={removeRow}>
          − Row
        </Button>
        <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={addCol}>
          + Col
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={removeCol}>
          − Col
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-[10px]"
          title="Reset column widths and row heights to even"
          onClick={resetEvenLayout}
        >
          <RotateCcw className="size-3.5 shrink-0" aria-hidden />
          Reset layout
        </Button>
      </div>
    </div>
  );
}

export function BrainstormNodeToolbar({ selected }: { selected: BrainstormFlowNode[] }) {
  const deleteSelectedNodes = useBrainstormStore((s) => s.deleteSelectedNodes);
  const duplicateSelectedNode = useBrainstormStore((s) => s.duplicateSelectedNode);

  if (selected.length === 0) return null;

  if (selected.length > 1) {
    return (
      <div className="flex max-h-[min(72vh,560px)] w-[min(300px,calc(100vw-2rem))] flex-col gap-2 overflow-y-auto rounded-md border bg-card/95 p-2 shadow-sm backdrop-blur-sm">
        <p className="text-xs font-semibold">{selected.length} objects selected</p>
        <p className="text-[10px] text-muted-foreground">Choose one object for full formatting and type options.</p>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="nodrag nopan h-8 flex-1 gap-1 text-[10px]"
            disabled
            title="Select a single object to duplicate"
          >
            <Copy className="size-3.5" />
            Duplicate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="nodrag nopan h-8 flex-1 gap-1 border-destructive/40 text-[10px] text-destructive hover:bg-destructive/10"
            onClick={() => deleteSelectedNodes()}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </div>
    );
  }

  const node = selected[0]!;
  const data = node.data as Record<string, unknown>;
  const typeLabel =
    node.type === "idea"
      ? "Idea"
      : node.type === "text"
        ? "Text"
        : node.type === "shape"
          ? "Shape"
          : node.type === "hierarchy"
            ? "Branch"
            : node.type === "image"
              ? "Image"
              : node.type === "container"
                ? "Container"
                : "Table";

  const shape = node.type === "shape" ? (node as ShapeFlowNode) : null;
  const showKindBlock =
    isIdeaNode(node) ||
    node.type === "hierarchy" ||
    node.type === "image" ||
    node.type === "table" ||
    node.type === "container" ||
    (shape !== null && shape.data.stencilLibrary !== "basic");

  return (
    <div className="flex max-h-[min(72vh,560px)] w-[min(300px,calc(100vw-2rem))] flex-col gap-2 overflow-y-auto rounded-md border bg-card/95 p-2 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-1.5">
        <p className="text-xs font-semibold">{typeLabel}</p>
        <span className="truncate font-mono text-[9px] text-muted-foreground" title={node.id}>
          {node.id.slice(0, 8)}…
        </span>
      </div>

      <StudioTextSection node={node} />

      {showKindBlock ? (
        <>
          <Separator />
          {isIdeaNode(node) ? <IdeaSection node={node} /> : null}
          {node.type === "hierarchy" ? <HierarchySection node={node as HierarchyFlowNode} /> : null}
          {node.type === "image" ? <ImageSection node={node as ImageFlowNode} /> : null}
          {node.type === "shape" ? <WireframePresetSection node={node as ShapeFlowNode} /> : null}
          {node.type === "table" ? <TableStructureSection node={node as TableFlowNode} /> : null}
          {node.type === "container" ? <ContainerContextSection node={node as ContainerFlowNode} /> : null}
        </>
      ) : null}

      <Separator />
      <AppearanceSection nodeId={node.id} data={data} />

      <Separator />
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="nodrag nopan h-8 flex-1 gap-1 text-[10px]"
          onClick={() => duplicateSelectedNode()}
        >
          <Copy className="size-3.5" />
          Duplicate
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="nodrag nopan h-8 flex-1 gap-1 border-destructive/40 text-[10px] text-destructive hover:bg-destructive/10"
          onClick={() => deleteSelectedNodes()}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}
