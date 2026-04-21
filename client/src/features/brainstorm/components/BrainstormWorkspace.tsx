import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { Edge } from "@xyflow/react";
import { consumeBrainstormNoteImport, ideaNodeFromBrainstormNoteImport } from "@/features/brainstorm/brainstormNoteImport";
import { BrainstormAIPanel } from "@/features/brainstorm/components/BrainstormAIPanel";
import { fetchBrainstormSessionById, saveBrainstormCanvas } from "@/features/brainstorm/api";
import type { BrainstormSaveStatus } from "@/features/brainstorm/saveStatus";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import type { IdeaFlowNode } from "@/features/brainstorm/types";

function mapNodesFromApi(
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: IdeaFlowNode["data"];
  }>,
): IdeaFlowNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: "idea",
    position: n.position,
    data: {
      title: n.data.title,
      description: n.data.description ?? "",
      tags: n.data.tags ?? [],
      status: n.data.status as IdeaFlowNode["data"]["status"],
      priority: n.data.priority as IdeaFlowNode["data"]["priority"],
    },
  }));
}

type BrainstormWorkspaceProps = {
  sessionId: string;
  children: React.ReactNode;
  onSaveStatusChange?: (status: BrainstormSaveStatus) => void;
};

export function BrainstormWorkspace({ sessionId, children, onSaveStatusChange }: BrainstormWorkspaceProps) {
  const sessionQuery = useQuery({
    queryKey: ["brainstorm", "session", sessionId],
    queryFn: () => fetchBrainstormSessionById(sessionId),
    enabled: Boolean(sessionId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const nodes = useBrainstormStore((s) => s.nodes);
  const edges = useBrainstormStore((s) => s.edges);
  const resetCanvas = useBrainstormStore((s) => s.resetCanvas);

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
  }, [sessionId, resetCanvas]);

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

    const { nodes: rawNodes, edges: rawEdges } = sessionQuery.data;
    let mapped = mapNodesFromApi(rawNodes);
    const pending = consumeBrainstormNoteImport();
    if (pending) {
      mapped = [...mapped, ideaNodeFromBrainstormNoteImport(pending, mapped.length)];
    }
    resetCanvas(mapped, rawEdges as Edge[]);
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
          await saveBrainstormCanvas(sessionId, { nodes, edges });
          lastPersistedRef.current = JSON.stringify({ nodes, edges });
          onSaveStatusChangeRef.current?.("saved");
          window.setTimeout(() => onSaveStatusChangeRef.current?.("idle"), 2200);
        } catch {
          onSaveStatusChangeRef.current?.("error");
        }
      })();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [nodes, edges, sessionId]);

  return (
    <div className="grid min-h-[min(560px,calc(100vh-11rem))] flex-1 grid-cols-1 gap-4 lg:min-h-[min(640px,calc(100vh-10rem))] lg:grid-cols-[1fr_min(100%,380px)] lg:items-stretch">
      <div className="relative flex min-h-[min(480px,calc(100vh-12rem))] flex-1 flex-col overflow-hidden rounded-lg border bg-background">
        {sessionQuery.isError && (
          <p className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Could not load session. Is the API running and the database migrated?
          </p>
        )}
        {sessionQuery.isLoading && (
          <p className="border-b px-3 py-2 text-xs text-muted-foreground">Loading session…</p>
        )}
        <div className="min-h-0 flex-1">{children}</div>
      </div>
      <BrainstormAIPanel sessionId={sessionId} />
    </div>
  );
}
