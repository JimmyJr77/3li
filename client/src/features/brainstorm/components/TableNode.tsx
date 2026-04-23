import { Handle, NodeResizer, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import type { TableFlowNode } from "@/features/brainstorm/types";
import { NodeCaptionWrapper } from "@/features/brainstorm/components/NodeCaptionWrapper";
import { nodeChromeToStyle } from "@/features/brainstorm/utils/nodeChrome";
import { cn } from "@/lib/utils";

const MIN_FR = 0.12;

function cloneRows(rows: string[][]): string[][] {
  return rows.map((r) => [...r]);
}

function clampFr(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 1;
  return Math.min(Math.max(x, MIN_FR), 32);
}

export function TableNode({ id, data, selected }: NodeProps<TableFlowNode>) {
  const patchNodeData = useBrainstormStore((s) => s.patchNodeData);
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();

  const numCols = data.rows[0]?.length ?? 1;
  const numRows = data.rows.length;

  const colWidths = useMemo(() => {
    const w = data.colWidths;
    if (w && w.length === numCols) return w.map(clampFr);
    return Array.from({ length: numCols }, () => 1);
  }, [data.colWidths, numCols]);

  const rowHeights = useMemo(() => {
    const h = data.rowHeights;
    if (h && h.length === numRows) return h.map(clampFr);
    return Array.from({ length: numRows }, () => 1);
  }, [data.rowHeights, numRows]);

  const sumCol = colWidths.reduce((a, b) => a + b, 0);
  const sumRow = rowHeights.reduce((a, b) => a + b, 0);

  const colResizeRef = useRef<{
    pointerId: number;
    startClient: number;
    snap: number[];
    index: number;
  } | null>(null);
  const rowResizeRef = useRef<{
    pointerId: number;
    startClient: number;
    snap: number[];
    index: number;
  } | null>(null);

  const setRows = useCallback(
    (next: string[][]) => {
      patchNodeData(id, { rows: next });
    },
    [id, patchNodeData],
  );

  const onCellChange = useCallback(
    (row: number, col: number, value: string) => {
      const rows = cloneRows(data.rows);
      if (!rows[row]) return;
      const r = [...rows[row]!];
      r[col] = value;
      rows[row] = r;
      setRows(rows);
    },
    [data.rows, setRows],
  );

  const endColResize = useCallback(() => {
    colResizeRef.current = null;
  }, []);

  const endRowResize = useCallback(() => {
    rowResizeRef.current = null;
  }, []);

  const onColGripPointerDown = useCallback(
    (colIndex: number) => (e: React.PointerEvent) => {
      if (!selected) return;
      e.preventDefault();
      e.stopPropagation();
      colResizeRef.current = {
        pointerId: e.pointerId,
        startClient: e.clientX,
        snap: [...colWidths],
        index: colIndex,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [colWidths, selected],
  );

  const onColGripPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = colResizeRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const el = gridRef.current;
      if (!el) return;
      const w = el.offsetWidth || 1;
      const sum = d.snap.reduce((a, b) => a + b, 0);
      const delta = e.clientX - d.startClient;
      const transfer = (delta / w) * sum * 0.55;
      const next = [...d.snap];
      const i = d.index;
      let a = next[i]! + transfer;
      let b = next[i + 1]! - transfer;
      if (a < MIN_FR) {
        b -= MIN_FR - a;
        a = MIN_FR;
      }
      if (b < MIN_FR) {
        a -= MIN_FR - b;
        b = MIN_FR;
      }
      next[i] = clampFr(a);
      next[i + 1] = clampFr(b);
      patchNodeData(id, { colWidths: next });
    },
    [id, patchNodeData],
  );

  const onColGripPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = colResizeRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      endColResize();
    },
    [endColResize],
  );

  const onRowGripPointerDown = useCallback(
    (rowIndex: number) => (e: React.PointerEvent) => {
      if (!selected) return;
      e.preventDefault();
      e.stopPropagation();
      rowResizeRef.current = {
        pointerId: e.pointerId,
        startClient: e.clientY,
        snap: [...rowHeights],
        index: rowIndex,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [rowHeights, selected],
  );

  const onRowGripPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = rowResizeRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const el = gridRef.current;
      if (!el) return;
      const h = el.offsetHeight || 1;
      const sum = d.snap.reduce((a, b) => a + b, 0);
      const delta = e.clientY - d.startClient;
      const transfer = (delta / h) * sum * 0.55;
      const next = [...d.snap];
      const i = d.index;
      let a = next[i]! + transfer;
      let b = next[i + 1]! - transfer;
      if (a < MIN_FR) {
        b -= MIN_FR - a;
        a = MIN_FR;
      }
      if (b < MIN_FR) {
        a -= MIN_FR - b;
        b = MIN_FR;
      }
      next[i] = clampFr(a);
      next[i + 1] = clampFr(b);
      patchNodeData(id, { rowHeights: next });
    },
    [id, patchNodeData],
  );

  const onRowGripPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = rowResizeRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      endRowResize();
    },
    [endRowResize],
  );

  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [
    id,
    data.rows,
    data.captionText,
    data.captionAlign,
    data.captionPlacement,
    colWidths,
    rowHeights,
    selected,
    updateNodeInternals,
  ]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => updateNodeInternals(id));
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, updateNodeInternals]);

  const colTemplate = colWidths.map((w) => `${w}fr`).join(" ");
  const rowTemplate = rowHeights.map((h) => `${h}fr`).join(" ");

  let colAcc = 0;
  const colGutterLeftPct: number[] = [];
  for (let i = 0; i < colWidths.length - 1; i++) {
    colAcc += colWidths[i]!;
    colGutterLeftPct.push((colAcc / sumCol) * 100);
  }

  let rowAcc = 0;
  const rowGutterTopPct: number[] = [];
  for (let i = 0; i < rowHeights.length - 1; i++) {
    rowAcc += rowHeights[i]!;
    rowGutterTopPct.push((rowAcc / sumRow) * 100);
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={100}
        lineClassName="!border-primary"
        handleClassName="!size-2.5 !rounded-sm !border !border-primary !bg-background"
      />
      <div
        ref={rootRef}
        className={cn(
          "flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden border-2 border-border bg-card shadow-sm",
          "rounded-lg",
          selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        )}
        style={nodeChromeToStyle(data)}
      >
        <Handle type="target" position={Position.Top} id="in" className="!size-2.5 !bg-muted-foreground" />
        <Handle
          type="target"
          position={Position.Left}
          id="lat-l-in"
          className="nodrag nopan !size-2.5 !bg-muted-foreground"
          style={{ top: "30%" }}
        />
        <Handle
          type="source"
          position={Position.Left}
          id="lat-l-out"
          className="nodrag nopan !size-2.5 !bg-muted-foreground"
          style={{ top: "70%" }}
        />
        <Handle
          type="target"
          position={Position.Right}
          id="lat-r-in"
          className="nodrag nopan !size-2.5 !bg-muted-foreground"
          style={{ top: "30%" }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="lat-r-out"
          className="nodrag nopan !size-2.5 !bg-muted-foreground"
          style={{ top: "70%" }}
        />

        <NodeCaptionWrapper
          captionText={data.captionText}
          captionAlign={data.captionAlign}
          captionPlacement={data.captionPlacement}
          className="relative flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <div className="relative min-h-0 flex-1 overflow-auto p-1">
            <div
              ref={gridRef}
              className="grid h-full min-h-[96px] w-full border border-border text-xs"
              style={{
                gridTemplateColumns: colTemplate,
                gridTemplateRows: rowTemplate,
              }}
            >
              {data.rows.map((row, ri) =>
                row.map((cell, ci) => (
                  <div
                    key={`${ri}-${ci}`}
                    className="min-h-0 min-w-0 border border-border"
                    style={{ gridRow: ri + 1, gridColumn: ci + 1 }}
                  >
                    <input
                      value={cell}
                      onChange={(e) => onCellChange(ri, ci, e.target.value)}
                      className="nodrag nopan box-border h-full min-h-[28px] w-full bg-transparent px-1.5 py-1 outline-none focus:bg-muted/40"
                    />
                  </div>
                )),
              )}
            </div>

            {selected && (colGutterLeftPct.length > 0 || rowGutterTopPct.length > 0) ? (
              <div className="pointer-events-none absolute inset-1">
                {colGutterLeftPct.map((leftPct, i) => (
                  <div
                    key={`cg-${i}`}
                    className="pointer-events-auto absolute bottom-0 top-0 z-[1] w-2 cursor-col-resize"
                    style={{ left: `calc(${leftPct}% - 4px)` }}
                    onPointerDown={onColGripPointerDown(i)}
                    onPointerMove={onColGripPointerMove}
                    onPointerUp={onColGripPointerUp}
                    onPointerCancel={onColGripPointerUp}
                  />
                ))}
                {rowGutterTopPct.map((topPct, i) => (
                  <div
                    key={`rg-${i}`}
                    className="pointer-events-auto absolute left-0 right-0 z-[2] h-2 cursor-row-resize"
                    style={{ top: `calc(${topPct}% - 4px)` }}
                    onPointerDown={onRowGripPointerDown(i)}
                    onPointerMove={onRowGripPointerMove}
                    onPointerUp={onRowGripPointerUp}
                    onPointerCancel={onRowGripPointerUp}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </NodeCaptionWrapper>

        <Handle type="source" position={Position.Bottom} id="out" className="!size-2.5 !bg-muted-foreground" />
      </div>
    </>
  );
}
