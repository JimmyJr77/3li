import { Handle, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { useLayoutEffect, useRef } from "react";
import type { TextFlowNode } from "@/features/brainstorm/types";
import { NodeCaptionWrapper } from "@/features/brainstorm/components/NodeCaptionWrapper";
import { nodeChromeToStyle } from "@/features/brainstorm/utils/nodeChrome";
import { cn } from "@/lib/utils";

export function TextNode({ id, data, selected }: NodeProps<TextFlowNode>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();

  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [
    id,
    selected,
    data.captionText,
    data.captionAlign,
    data.captionPlacement,
    data.backgroundColor,
    data.color,
    data.borderColor,
    data.borderWidthPx,
    updateNodeInternals,
  ]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      updateNodeInternals(id);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, updateNodeInternals]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex min-w-[140px] flex-col rounded-md border-2 border-border bg-card p-1 shadow-sm",
        selected ? "min-h-[80px]" : "min-h-0 h-auto",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
      style={nodeChromeToStyle(data)}
    >
      <Handle type="target" position={Position.Top} className="!size-2.5 !bg-muted-foreground" />
      <NodeCaptionWrapper
        captionText={data.captionText}
        captionAlign={data.captionAlign}
        captionPlacement={data.captionPlacement}
        className="min-h-0 flex-1"
      >
        <div
          className={cn(
            "min-h-[48px] w-full rounded-sm border border-dashed border-border/70 bg-muted/15",
            selected ? "min-h-[52px] flex-1" : "min-h-0 flex-none",
          )}
          aria-hidden
        />
      </NodeCaptionWrapper>
      <Handle type="source" position={Position.Bottom} className="!size-2.5 !bg-muted-foreground" />
    </div>
  );
}
