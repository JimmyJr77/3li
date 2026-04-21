import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useEffect, useLayoutEffect, useState } from "react";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import type { IdeaFlowNode } from "@/features/brainstorm/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function parseTagsInput(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

const statuses = ["idea", "validated", "executing"] as const;
const priorities = ["low", "medium", "high"] as const;

export function IdeaNode({ id, data, selected }: NodeProps<IdeaFlowNode>) {
  const updateIdeaData = useBrainstormStore((s) => s.updateIdeaData);
  const [tagsDraft, setTagsDraft] = useState(() => data.tags.join(", "));

  useLayoutEffect(() => {
    setTagsDraft(data.tags.join(", "));
  }, [id]);

  useEffect(() => {
    const parsed = parseTagsInput(tagsDraft);
    const t = setTimeout(() => {
      updateIdeaData(id, { tags: parsed });
    }, 300);
    return () => clearTimeout(t);
  }, [tagsDraft, id, updateIdeaData]);

  return (
    <div
      className={cn(
        "min-w-[220px] max-w-[280px] rounded-lg border bg-card p-3 shadow-sm",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-2.5 !bg-muted-foreground" />
      <div className="space-y-2">
        <div>
          <Label htmlFor={`${id}-title`} className="text-xs text-muted-foreground">
            Title
          </Label>
          <Input
            id={`${id}-title`}
            value={data.title}
            onChange={(e) => updateIdeaData(id, { title: e.target.value })}
            className="mt-0.5 h-8 text-sm font-medium"
          />
        </div>
        <div>
          <Label htmlFor={`${id}-desc`} className="text-xs text-muted-foreground">
            Notes
          </Label>
          <textarea
            id={`${id}-desc`}
            value={data.description}
            onChange={(e) => updateIdeaData(id, { description: e.target.value })}
            rows={2}
            className="border-input bg-background mt-0.5 w-full resize-none rounded-md border px-2 py-1.5 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase text-muted-foreground">Status</span>
            <select
              value={data.status}
              onChange={(e) =>
                updateIdeaData(id, { status: e.target.value as (typeof statuses)[number] })
              }
              className="border-input bg-background h-7 rounded-md border px-1 text-xs"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase text-muted-foreground">Priority</span>
            <select
              value={data.priority}
              onChange={(e) =>
                updateIdeaData(id, { priority: e.target.value as (typeof priorities)[number] })
              }
              className="border-input bg-background h-7 rounded-md border px-1 text-xs"
            >
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor={`${id}-tags`} className="text-xs text-muted-foreground">
            Tags (comma-separated)
          </Label>
          <Input
            id={`${id}-tags`}
            value={tagsDraft}
            onChange={(e) => setTagsDraft(e.target.value)}
            onBlur={() => updateIdeaData(id, { tags: parseTagsInput(tagsDraft) })}
            className="mt-0.5 h-7 text-xs"
          />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!size-2.5 !bg-muted-foreground" />
    </div>
  );
}
