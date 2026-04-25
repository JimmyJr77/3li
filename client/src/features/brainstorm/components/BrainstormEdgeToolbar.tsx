import { Trash2 } from "lucide-react";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import type { LineStyle } from "@/features/brainstorm/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const styles: { id: LineStyle; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "solid_bold", label: "Bold" },
  { id: "dotted", label: "Dotted" },
];

export function BrainstormEdgeToolbar() {
  const edges = useBrainstormStore((s) => s.edges);
  const selectedEdgeId = useBrainstormStore((s) => s.selectedEdgeId);
  const setEdgeLineStyle = useBrainstormStore((s) => s.setEdgeLineStyle);
  const patchEdgeData = useBrainstormStore((s) => s.patchEdgeData);
  const removeEdge = useBrainstormStore((s) => s.removeEdge);

  const edge = edges.find((e) => e.id === selectedEdgeId);
  if (!edge) {
    return null;
  }

  const current = edge.data?.lineStyle ?? "solid";
  const labelDraft = edge.data?.label ?? "";

  return (
    <div className="flex flex-col gap-1 rounded-md border bg-card/95 p-2 shadow-sm backdrop-blur-sm">
      <div className="space-y-1">
        <Label htmlFor="brainstorm-edge-label" className="text-[10px] font-medium text-muted-foreground">
          Link text
        </Label>
        <Input
          id="brainstorm-edge-label"
          value={labelDraft}
          placeholder="Optional label on this link"
          className="nodrag nopan h-8 text-xs"
          onChange={(e) => patchEdgeData(edge.id, { label: e.target.value })}
        />
      </div>
      <p className="text-[10px] font-medium text-muted-foreground">Edge line</p>
      <div className="flex flex-wrap gap-1">
        {styles.map((s) => (
          <Button
            key={s.id}
            type="button"
            size="sm"
            variant={current === s.id ? "default" : "outline"}
            className={cn("h-7 px-2 text-[10px]", current === s.id && "pointer-events-none")}
            onClick={() => setEdgeLineStyle(edge.id, s.id)}
          >
            {s.label}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="nodrag nopan mt-1 h-7 w-full gap-1 border-destructive/40 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => removeEdge(edge.id)}
      >
        <Trash2 className="size-3 shrink-0" aria-hidden />
        Delete link
      </Button>
    </div>
  );
}
