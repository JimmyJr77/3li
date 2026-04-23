import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { HierarchyFlowNode } from "@/features/brainstorm/types";
import { NodeCaptionWrapper } from "@/features/brainstorm/components/NodeCaptionWrapper";
import { nodeCaptionPropsFromData } from "@/features/brainstorm/types";
import { nodeChromeToStyle } from "@/features/brainstorm/utils/nodeChrome";
import { cn } from "@/lib/utils";

export function HierarchyNode({ data, selected }: NodeProps<HierarchyFlowNode>) {
  const cap = nodeCaptionPropsFromData(data);
  const outsideVisible =
    (data.outsideCaptionText ?? "").trim() || (data.label ?? "").trim() || "Branch";

  return (
    <div
      className={cn(
        "flex min-w-[140px] flex-col gap-2",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
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
      <NodeCaptionWrapper {...cap} outsideCaptionText={outsideVisible} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className="relative w-full min-w-[120px] min-h-[72px] shrink-0 rounded-md border-2 border-border bg-card shadow-sm"
          style={nodeChromeToStyle(data)}
        />
      </NodeCaptionWrapper>
      <Handle type="source" position={Position.Bottom} id="out" className="!size-2.5 !bg-muted-foreground" />
    </div>
  );
}
