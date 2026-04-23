import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { consumeBrainstormNoteImport, ideaNodeFromBrainstormNoteImport } from "@/features/brainstorm/brainstormNoteImport";
import { BrainstormAgentsSheet } from "@/features/brainstorm/components/BrainstormAgentsSheet";
import { BrainstormCanvasTools } from "@/features/brainstorm/components/BrainstormCanvasTools";
import type { BrainstormSessionResponse } from "@/features/brainstorm/api";
import { fetchBrainstormSessionById, saveBrainstormCanvas } from "@/features/brainstorm/api";
import type { BrainstormSaveStatus } from "@/features/brainstorm/saveStatus";
import { normalizeBrainstormNode, useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import type { BrainstormEdge, BrainstormFlowNode, TextFlowNode } from "@/features/brainstorm/types";
import { isIdeaNode } from "@/features/brainstorm/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function normalizeEdgesFromApi(edges: BrainstormSessionResponse["edges"]): BrainstormEdge[] {
  return edges.map((e) => ({
    ...e,
    data: {
      lineStyle: e.data?.lineStyle ?? "solid",
      label: typeof e.data?.label === "string" ? e.data.label : "",
    },
  }));
}

/** Root-level text cards: omit width/height only when unset so React Flow can measure; keep user-resized sizes. */
function normalizeRootTextNodesForMeasurement(nodes: BrainstormFlowNode[]): BrainstormFlowNode[] {
  return nodes.map((n) => {
    if (n.type !== "text" || n.parentId) return n;
    if (typeof n.width === "number" || typeof n.height === "number") return n;
    const { width: _w, height: _h, ...rest } = n as TextFlowNode;
    return rest as TextFlowNode;
  });
}

function mapSessionFromApi(data: BrainstormSessionResponse): {
  nodes: BrainstormFlowNode[];
  edges: BrainstormEdge[];
} {
  const normalized = (data.nodes as BrainstormFlowNode[]).map(normalizeBrainstormNode);
  return {
    nodes: normalizeRootTextNodesForMeasurement(normalized),
    edges: normalizeEdgesFromApi(data.edges),
  };
}

type BrainstormWorkspaceProps = {
  workspaceId: string;
  sessionId: string;
  children: ReactNode;
  /** Renders above the canvas, inside the idea-board column (aligned with canvas width). */
  header?: ReactNode;
  onSaveStatusChange?: (status: BrainstormSaveStatus) => void;
};

export function BrainstormWorkspace({
  workspaceId,
  sessionId,
  children,
  header,
  onSaveStatusChange,
}: BrainstormWorkspaceProps) {
  const sessionQuery = useQuery({
    queryKey: ["brainstorm", "session", workspaceId, sessionId],
    queryFn: () => fetchBrainstormSessionById(sessionId, workspaceId),
    enabled: Boolean(sessionId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const nodes = useBrainstormStore((s) => s.nodes);
  const edges = useBrainstormStore((s) => s.edges);
  const resetCanvas = useBrainstormStore((s) => s.resetCanvas);
  const presentationMode = useBrainstormStore((s) => s.presentationMode);
  const setPresentationMode = useBrainstormStore((s) => s.setPresentationMode);

  const fsRef = useRef<HTMLDivElement>(null);
  const toolsAsideRef = useRef<HTMLDivElement>(null);
  const [hideCanvasTools, setHideCanvasTools] = useState(false);
  const [edgeToolsPeekOpen, setEdgeToolsPeekOpen] = useState(false);
  const peekCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPeekClose = useCallback(() => {
    if (peekCloseTimer.current !== null) {
      clearTimeout(peekCloseTimer.current);
      peekCloseTimer.current = null;
    }
  }, []);

  const schedulePeekClose = useCallback(() => {
    cancelPeekClose();
    peekCloseTimer.current = window.setTimeout(() => {
      setEdgeToolsPeekOpen(false);
      peekCloseTimer.current = null;
    }, 400);
  }, [cancelPeekClose]);

  const openEdgePeek = useCallback(() => {
    cancelPeekClose();
    setEdgeToolsPeekOpen(true);
  }, [cancelPeekClose]);

  useEffect(() => {
    if (!presentationMode) {
      setHideCanvasTools(false);
      setEdgeToolsPeekOpen(false);
      cancelPeekClose();
    }
  }, [presentationMode, cancelPeekClose]);

  useEffect(() => () => cancelPeekClose(), [cancelPeekClose]);

  const hydratedRef = useRef(false);
  /** Dedupes React Strict Mode double effect runs for the same fetched session snapshot. */
  const lastHydrateSigRef = useRef<string | null>(null);
  const lastPersistedRef = useRef<string | null>(null);
  const onSaveStatusChangeRef = useRef(onSaveStatusChange);
  onSaveStatusChangeRef.current = onSaveStatusChange;

  useEffect(() => {
    resetCanvas([], []);
    hydratedRef.current = false;
    lastHydrateSigRef.current = null;
    lastPersistedRef.current = null;
    onSaveStatusChangeRef.current?.("idle");
  }, [sessionId, workspaceId, resetCanvas]);

  useEffect(() => {
    if (!sessionQuery.isSuccess || !sessionQuery.data) {
      return;
    }
    if (sessionQuery.data.session.id !== sessionId) {
      return;
    }
    const hydrateSig = `${sessionId}:${sessionQuery.dataUpdatedAt}`;
    if (lastHydrateSigRef.current === hydrateSig) {
      return;
    }
    lastHydrateSigRef.current = hydrateSig;

    const mappedBase = mapSessionFromApi(sessionQuery.data);
    let mapped = mappedBase.nodes;
    const rawEdges = mappedBase.edges;
    const pending = consumeBrainstormNoteImport();
    if (pending) {
      mapped = [...mapped, ideaNodeFromBrainstormNoteImport(pending, mapped.filter(isIdeaNode).length)];
    }
    resetCanvas(mapped, rawEdges);
    hydratedRef.current = true;
    lastPersistedRef.current = null;
  }, [sessionQuery.isSuccess, sessionQuery.data, sessionQuery.dataUpdatedAt, sessionId, resetCanvas]);

  useEffect(() => {
    if (!hydratedRef.current || !sessionId) {
      return;
    }
    const snapshot = JSON.stringify({ nodes, edges });

    if (lastPersistedRef.current === null) {
      lastPersistedRef.current = snapshot;
      onSaveStatusChangeRef.current?.("idle");
      return;
    }
    if (lastPersistedRef.current === snapshot) {
      return;
    }

    onSaveStatusChangeRef.current?.("pending");
    const timer = window.setTimeout(() => {
      onSaveStatusChangeRef.current?.("saving");
      void (async () => {
        try {
          await saveBrainstormCanvas(sessionId, workspaceId, { nodes, edges });
          lastPersistedRef.current = JSON.stringify({ nodes, edges });
          onSaveStatusChangeRef.current?.("saved");
          window.setTimeout(() => onSaveStatusChangeRef.current?.("idle"), 2200);
        } catch {
          onSaveStatusChangeRef.current?.("error");
        }
      })();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [nodes, edges, sessionId, workspaceId]);

  useEffect(() => {
    if (!presentationMode) return;
    const el = fsRef.current;
    if (!el) return;
    void (async () => {
      try {
        await el.requestFullscreen();
      } catch {
        /* optional */
      }
    })();
    return () => {
      if (document.fullscreenElement === el) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, [presentationMode]);

  useEffect(() => {
    const onFs = () => {
      if (document.fullscreenElement) return;
      const st = useBrainstormStore.getState();
      if (st.presentationMode) st.setPresentationMode(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toolsPaneClass =
    "flex min-h-0 w-[min(15rem,calc(100vw-2rem))] max-w-[16rem] flex-col gap-2 rounded-md border bg-card/95 p-3 shadow-sm";

  const outerClass = cn(
    "min-h-0 flex-1",
    presentationMode
      ? "fixed inset-0 z-50 m-0 flex min-h-0 flex-row gap-2 bg-background p-2 lg:gap-3"
      : "grid min-h-[min(560px,calc(100vh-11rem))] grid-cols-1 gap-4 lg:min-h-[min(640px,calc(100vh-10rem))] lg:items-stretch",
  );

  return (
    <div ref={fsRef} className={outerClass}>
      {presentationMode && hideCanvasTools ? (
        <>
          <div
            data-brainstorm-edge-peek-strip=""
            className="pointer-events-auto fixed inset-y-0 left-0 z-[55] w-5"
            aria-hidden
            onMouseEnter={openEdgePeek}
            onMouseLeave={(e) => {
              const next = e.relatedTarget as Node | null;
              if (toolsAsideRef.current?.contains(next)) return;
              schedulePeekClose();
            }}
          />
          <aside
            ref={toolsAsideRef}
            aria-label="Canvas tools"
            className={cn(
              toolsPaneClass,
              "pointer-events-auto fixed left-0 top-0 z-[56] h-[100dvh] max-h-[100dvh] shadow-lg transition-transform duration-200 ease-out",
              edgeToolsPeekOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
            )}
            onMouseEnter={openEdgePeek}
            onMouseLeave={(e) => {
              const next = e.relatedTarget as HTMLElement | null;
              if (next?.closest?.("[data-brainstorm-edge-peek-strip]")) return;
              if (toolsAsideRef.current?.contains(next)) return;
              schedulePeekClose();
            }}
          >
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full shrink-0 justify-start text-xs font-normal"
              aria-pressed={hideCanvasTools}
              onClick={() => {
                setHideCanvasTools(false);
                setEdgeToolsPeekOpen(false);
                cancelPeekClose();
              }}
            >
              Hide canvas tools
            </Button>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <BrainstormCanvasTools layout="presentation" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full shrink-0"
              onClick={() => setPresentationMode(false)}
            >
              Exit full screen
            </Button>
          </aside>
        </>
      ) : null}
      {presentationMode && !hideCanvasTools ? (
        <aside className={cn(toolsPaneClass, "shrink-0 self-stretch")} aria-label="Canvas tools">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full shrink-0 justify-start text-xs font-normal"
            aria-pressed={false}
            onClick={() => setHideCanvasTools(true)}
          >
            Hide canvas tools
          </Button>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <BrainstormCanvasTools layout="presentation" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full shrink-0"
            onClick={() => setPresentationMode(false)}
          >
            Exit full screen
          </Button>
        </aside>
      ) : null}
      <div
        className={cn(
          "relative flex min-h-[min(480px,calc(100vh-12rem))] flex-1 flex-col overflow-hidden rounded-lg border bg-background",
          presentationMode && "min-h-0 min-w-0 rounded-md",
        )}
      >
        {sessionQuery.isError && (
          <p className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Could not load studio board. Is the API running and the database migrated?
          </p>
        )}
        {sessionQuery.isLoading && (
          <p className="border-b px-3 py-2 text-xs text-muted-foreground">Loading studio board…</p>
        )}
        {header ? <div className="shrink-0 border-b bg-background px-3 py-2.5">{header}</div> : null}
        <div className="min-h-0 flex-1">{children}</div>
      </div>
      <BrainstormAgentsSheet sessionId={sessionId} workspaceId={workspaceId} />
    </div>
  );
}
