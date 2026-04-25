import { Handle, NodeResizer, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { useLayoutEffect, useRef } from "react";
import type { ContainerFlowNode } from "@/features/brainstorm/types";
import { NodeCaptionWrapper } from "@/features/brainstorm/components/NodeCaptionWrapper";
import { nodeCaptionPropsFromData } from "@/features/brainstorm/types";
import { nodeChromeToStyle } from "@/features/brainstorm/utils/nodeChrome";
import { cn } from "@/lib/utils";

export function ContainerNode({ id, data, selected }: NodeProps<ContainerFlowNode>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();

  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [
    id,
    selected,
    data.captionText,
    data.captionAlign,
    data.captionVerticalAlign,
    data.outsideCaptionText,
    data.outsideCaptionAlign,
    data.outsideCaptionPlacement,
    updateNodeInternals,
  ]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => updateNodeInternals(id));
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, updateNodeInternals]);

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={160}
        lineClassName="!border-primary/70"
        handleClassName="!size-2.5 !rounded-sm !border !border-primary/70 !bg-background"
      />
      <div
        ref={rootRef}
        className={cn(
          "flex h-full w-full min-h-0 min-w-0 flex-col overflow-visible rounded-lg",
          selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        )}
      >
        <Handle type="target" position={Position.Top} className="!size-2.5 !bg-muted-foreground" />
        <NodeCaptionWrapper {...nodeCaptionPropsFromData(data)} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border-2 border-dashed border-primary/45 bg-muted/10"
            style={nodeChromeToStyle(data)}
          >
            <div className="min-h-0 flex-1" aria-hidden />
          </div>
        </NodeCaptionWrapper>
        <Handle type="source" position={Position.Bottom} className="!size-2.5 !bg-muted-foreground" />
      </div>
    </>
  );
}
