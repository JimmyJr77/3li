import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useSearchParams } from "react-router-dom";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import type { IdeaFlowNode } from "@/features/brainstorm/types";
import {
  clearRoutedGlow,
  useRoutedBrainstormGlow,
} from "@/features/rapidRouter/routedHighlightStore";
import { NodeCaptionWrapper } from "@/features/brainstorm/components/NodeCaptionWrapper";
import { nodeChromeToStyle } from "@/features/brainstorm/utils/nodeChrome";
import { cn } from "@/lib/utils";

export function IdeaNode({ id, data, selected }: NodeProps<IdeaFlowNode>) {
  const { activeWorkspaceId } = useActiveWorkspace();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";
  const routedGlow = useRoutedBrainstormGlow(
    id,
    activeWorkspaceId ?? undefined,
    sessionId || undefined,
  );

  return (
    <div
      data-slot="card"
      onPointerDownCapture={() => {
        if (activeWorkspaceId && sessionId) {
          clearRoutedGlow("brainstorm", id, activeWorkspaceId, sessionId);
        }
      }}
      className={cn(
        "min-w-[220px] max-w-[280px] rounded-lg border-2 border-border bg-card p-3 shadow-sm",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        routedGlow &&
          "ring-2 ring-yellow-400/75 ring-offset-2 ring-offset-background shadow-[0_0_22px_rgba(234,179,8,0.45)]",
      )}
      style={nodeChromeToStyle(data)}
    >
      <Handle type="target" position={Position.Top} className="!size-2.5 !bg-muted-foreground" />
      <NodeCaptionWrapper
        captionText={data.captionText}
        captionAlign={data.captionAlign}
        captionPlacement={data.captionPlacement}
      >
        <div className="space-y-2 select-none">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Title</p>
            <p className="mt-0.5 text-sm font-medium leading-snug">{data.title}</p>
          </div>
          {data.description ? (
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Notes</p>
              <p className="mt-0.5 whitespace-pre-wrap text-xs leading-snug text-foreground/90">{data.description}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
            <span className="rounded border border-border/80 px-1.5 py-0.5">{data.status}</span>
            <span className="rounded border border-border/80 px-1.5 py-0.5">{data.priority}</span>
          </div>
          {data.tags.length > 0 ? (
            <p className="text-[10px] leading-snug text-muted-foreground">Tags: {data.tags.join(", ")}</p>
          ) : null}
        </div>
      </NodeCaptionWrapper>
      <Handle type="source" position={Position.Bottom} className="!size-2.5 !bg-muted-foreground" />
    </div>
  );
}
