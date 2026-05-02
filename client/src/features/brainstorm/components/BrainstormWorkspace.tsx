import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { consumeBrainstormNoteImport, ideaNodeFromBrainstormNoteImport } from "@/features/brainstorm/brainstormNoteImport";
import { BrainstormAgentsSheet } from "@/features/brainstorm/components/BrainstormAgentsSheet";
import { BrainstormCanvasTools } from "@/features/brainstorm/components/BrainstormCanvasTools";
import type { BrainstormSessionResponse, BrainstormSessionsListResponse } from "@/features/brainstorm/api";
import { fetchBrainstormSessionById, saveBrainstormCanvas } from "@/features/brainstorm/api";
import type { BrainstormSaveStatus } from "@/features/brainstorm/saveStatus";
import { normalizeBrainstormNode, useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import type { BrainstormEdge, BrainstormFlowNode, TextFlowNode } from "@/features/brainstorm/types";
import { isIdeaNode } from "@/features/brainstorm/types";
import { normalizeExtentForContainerChildren } from "@/features/brainstorm/utils/nodeLayout";
import { Button } from "@/components/ui/button";
import { AUTOSAVE_DEBOUNCE_MS } from "@/lib/autosave";
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
    nodes: normalizeRootTextNodesForMeasurement(normalizeExtentForContainerChildren(normalized)),
    edges: normalizeEdgesFromApi(data.edges),
  };
}

/** Maps API session to canvas nodes/edges; optionally consumes one-shot note import (initial load only). */
function buildHydratedCanvasPayload(
  data: BrainstormSessionResponse,
  sessionId: string,
  includeNoteImport: boolean,
): { nodes: BrainstormFlowNode[]; edges: BrainstormEdge[] } {
  if (data.session.id !== sessionId) {
    return { nodes: [], edges: [] };
  }
  const mappedBase = mapSessionFromApi(data);
  let mapped = mappedBase.nodes;
  const rawEdges = mappedBase.edges;
  if (includeNoteImport) {
    const pending = consumeBrainstormNoteImport();
    if (pending) {
      mapped = [...mapped, ideaNodeFromBrainstormNoteImport(pending, mapped.filter(isIdeaNode).length)];
    }
  }
  const selectedIds = new Set(
    useBrainstormStore.getState().nodes.filter((n) => n.selected).map((n) => n.id),
  );
  if (selectedIds.size > 0) {
    mapped = mapped.map((n) => ({
      ...n,
      selected: selectedIds.has(n.id),
    }));
  } else {
    mapped = mapped.map((n) => ({ ...n, selected: false }));
  }
  return { nodes: mapped, edges: rawEdges };
}

type BrainstormWorkspaceProps = {
  workspaceId: string;
  sessionId: string;
  children: ReactNode;
  /** Renders above the canvas, inside the idea-board column (aligned with canvas width). */
  header?: ReactNode;
  onSaveStatusChange?: (status: BrainstormSaveStatus) => void;
  /** Increment to flush debounced autosave immediately (Save Board). */
  saveBoardFlushNonce?: number;
  /** When true, periodically refetch the session so another viewer’s saves can apply while the canvas is clean. */
  remotePresenceActive?: boolean;
  /** Fires when local canvas differs from the last successful save snapshot. */
  onCanvasDirtyChange?: (dirty: boolean) => void;
};

export function BrainstormWorkspace({
  workspaceId,
  sessionId,
  children,
  header,
  onSaveStatusChange,
  saveBoardFlushNonce = 0,
  remotePresenceActive = false,
  onCanvasDirtyChange,
}: BrainstormWorkspaceProps) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: ["brainstorm", "session", workspaceId, sessionId],
    queryFn: () => fetchBrainstormSessionById(sessionId, workspaceId),
    enabled: Boolean(sessionId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchInterval: remotePresenceActive ? 12_000 : false,
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
  /** Serializes canvas PUTs so rapid edits never overlap; each job drains until local state matches the server. */
  const persistChainRef = useRef<Promise<void>>(Promise.resolve());
  const onSaveStatusChangeRef = useRef(onSaveStatusChange);
  onSaveStatusChangeRef.current = onSaveStatusChange;
  const onCanvasDirtyChangeRef = useRef(onCanvasDirtyChange);
  onCanvasDirtyChangeRef.current = onCanvasDirtyChange;
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHandledFlushNonceRef = useRef(saveBoardFlushNonce);

  const clearPersistDebounce = useCallback(() => {
    if (persistDebounceRef.current !== null) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
  }, []);

  useEffect(() => {
    resetCanvas([], []);
    hydratedRef.current = false;
    lastHydrateSigRef.current = null;
    lastPersistedRef.current = null;
    persistChainRef.current = Promise.resolve();
    clearPersistDebounce();
    lastHandledFlushNonceRef.current = saveBoardFlushNonce;
    onSaveStatusChangeRef.current?.("idle");
    onCanvasDirtyChangeRef.current?.(false);
  }, [sessionId, workspaceId, resetCanvas, clearPersistDebounce]);

  const runPersistLoop = useCallback(() => {
    if (!hydratedRef.current || !sessionId) return;
    persistChainRef.current = persistChainRef.current
      .then(async () => {
        let didSave = false;
        while (true) {
          const live = useBrainstormStore.getState();
          const liveSnap = JSON.stringify({ nodes: live.nodes, edges: live.edges });
          if (liveSnap === lastPersistedRef.current) break;

          onSaveStatusChangeRef.current?.("saving");
          try {
            await saveBrainstormCanvas(sessionId, workspaceId, {
              nodes: live.nodes,
              edges: live.edges,
            });
            didSave = true;
            lastPersistedRef.current = JSON.stringify({
              nodes: useBrainstormStore.getState().nodes,
              edges: useBrainstormStore.getState().edges,
            });
          } catch {
            onSaveStatusChangeRef.current?.("error");
            return;
          }
        }
        if (didSave) {
          queryClient.setQueryData<BrainstormSessionsListResponse | undefined>(
            ["brainstorm", "sessions-list", workspaceId],
            (old) => {
              if (!old?.sessions) return old;
              const count = useBrainstormStore.getState().nodes.length;
              return {
                ...old,
                sessions: old.sessions.map((s) =>
                  s.id === sessionId ? { ...s, nodeCount: count, updatedAt: new Date().toISOString() } : s,
                ),
              };
            },
          );
          onSaveStatusChangeRef.current?.("saved");
          onCanvasDirtyChangeRef.current?.(false);
          window.setTimeout(() => onSaveStatusChangeRef.current?.("idle"), 2200);
        }
      })
      .catch(() => {
        onSaveStatusChangeRef.current?.("error");
      });
  }, [sessionId, workspaceId, queryClient]);

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

    const includeNoteImport = !hydratedRef.current;
    const { nodes: mappedNodes, edges: mappedEdges } = buildHydratedCanvasPayload(
      sessionQuery.data,
      sessionId,
      includeNoteImport,
    );
    const serverSnap = JSON.stringify({ nodes: mappedNodes, edges: mappedEdges });

    if (!hydratedRef.current) {
      lastHydrateSigRef.current = hydrateSig;
      resetCanvas(mappedNodes, mappedEdges, { keepShapePickerOpen: true });
      hydratedRef.current = true;
      lastPersistedRef.current = null;
      return;
    }

    lastHydrateSigRef.current = hydrateSig;

    const liveSnap = JSON.stringify({
      nodes: useBrainstormStore.getState().nodes,
      edges: useBrainstormStore.getState().edges,
    });
    const persisted = lastPersistedRef.current;
    if (persisted !== null && liveSnap !== persisted) {
      return;
    }
    if (persisted !== null && serverSnap === persisted) {
      return;
    }

    resetCanvas(mappedNodes, mappedEdges, { keepShapePickerOpen: true });
    lastPersistedRef.current = JSON.stringify({
      nodes: useBrainstormStore.getState().nodes,
      edges: useBrainstormStore.getState().edges,
    });
  }, [sessionQuery.isSuccess, sessionQuery.data, sessionQuery.dataUpdatedAt, sessionId, resetCanvas]);

  useEffect(() => {
    return () => clearPersistDebounce();
  }, [clearPersistDebounce]);

  useEffect(() => {
    if (saveBoardFlushNonce === lastHandledFlushNonceRef.current) {
      return;
    }
    lastHandledFlushNonceRef.current = saveBoardFlushNonce;
    clearPersistDebounce();
    runPersistLoop();
  }, [saveBoardFlushNonce, runPersistLoop, clearPersistDebounce]);

  useEffect(() => {
    if (!hydratedRef.current || !sessionId) {
      return;
    }
    const snapshot = JSON.stringify({ nodes, edges });

    if (lastPersistedRef.current === null) {
      lastPersistedRef.current = snapshot;
      onSaveStatusChangeRef.current?.("idle");
      onCanvasDirtyChangeRef.current?.(false);
      return;
    }
    if (lastPersistedRef.current === snapshot) {
      onCanvasDirtyChangeRef.current?.(false);
      return;
    }

    onCanvasDirtyChangeRef.current?.(true);
    clearPersistDebounce();
    persistDebounceRef.current = window.setTimeout(() => {
      persistDebounceRef.current = null;
      runPersistLoop();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [nodes, edges, sessionId, runPersistLoop, clearPersistDebounce]);

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
        {header ? (
          <div
            data-brainstorm-workspace-header
            className="shrink-0 border-b bg-background px-3 py-2.5"
          >
            {header}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 bg-white dark:bg-background">{children}</div>
      </div>
      <BrainstormAgentsSheet sessionId={sessionId} workspaceId={workspaceId} />
    </div>
  );
}
