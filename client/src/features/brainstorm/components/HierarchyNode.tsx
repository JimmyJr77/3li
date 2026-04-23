import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { HierarchyFlowNode } from "@/features/brainstorm/types";
import { NodeCaptionWrapper } from "@/features/brainstorm/components/NodeCaptionWrapper";
import { nodeChromeToStyle } from "@/features/brainstorm/utils/nodeChrome";
import { cn } from "@/lib/utils";

export function HierarchyNode({ data, selected }: NodeProps<HierarchyFlowNode>) {
  const display = (data.captionText ?? "").trim() || data.label || "Branch";

  return (
    <div
      className={cn(
        "min-w-[140px] rounded-md border-2 border-border bg-card px-2 py-2 shadow-sm",
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
        captionText={display}
        captionAlign={data.captionAlign}
        captionPlacement={data.captionPlacement}
      >
        <div className="min-h-[6px] w-full min-w-[120px] rounded-sm bg-muted/25" aria-hidden />
      </NodeCaptionWrapper>
      <Handle type="source" position={Position.Bottom} id="out" className="!size-2.5 !bg-muted-foreground" />
    </div>
  );
}
