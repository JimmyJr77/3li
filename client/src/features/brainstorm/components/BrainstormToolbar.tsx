import { Check, CloudOff, Lightbulb, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BrainstormSaveStatus } from "@/features/brainstorm/saveStatus";
import { useBrainstormStore, type ThinkingMode } from "@/features/brainstorm/stores/brainstormStore";

const modes: { id: ThinkingMode; label: string }[] = [
  { id: "divergent", label: "Divergent" },
  { id: "convergent", label: "Convergent" },
  { id: "strategic", label: "Strategic" },
  { id: "execution", label: "Execution" },
];

const modeAccent: Record<ThinkingMode, string> = {
  divergent:
    "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300 vibrant:border-violet-500/65 vibrant:bg-violet-500/16 vibrant:text-violet-800",
  convergent:
    "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 vibrant:border-emerald-500/60 vibrant:bg-emerald-500/14 vibrant:text-emerald-900",
  strategic:
    "border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300 vibrant:border-sky-500/60 vibrant:bg-sky-500/14 vibrant:text-sky-900",
  execution:
    "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200 vibrant:border-amber-500/60 vibrant:bg-amber-500/14 vibrant:text-amber-950",
};

type BrainstormToolbarProps = {
  saveStatus?: BrainstormSaveStatus;
};

export function BrainstormToolbar({ saveStatus = "idle" }: BrainstormToolbarProps) {
  const thinkingMode = useBrainstormStore((s) => s.thinkingMode);
  const setThinkingMode = useBrainstormStore((s) => s.setThinkingMode);
  const addIdeaNode = useBrainstormStore((s) => s.addIdeaNode);

  const saveLabel = (() => {
    switch (saveStatus) {
      case "pending":
        return "Unsaved changes…";
      case "saving":
        return "Saving…";
      case "saved":
        return "Saved";
      case "error":
        return "Save failed";
      default:
        return null;
    }
  })();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Brainstorming Studio</h1>
        </div>
        {saveLabel && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
              saveStatus === "saved" &&
                "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 vibrant:border-emerald-500/55 vibrant:bg-emerald-500/14 vibrant:text-emerald-900",
              saveStatus === "saving" && "border-border bg-muted/60 text-muted-foreground",
              saveStatus === "pending" &&
                "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100 vibrant:border-amber-500/55 vibrant:bg-amber-500/14 vibrant:text-amber-950",
              saveStatus === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
            )}
            role="status"
            aria-live="polite"
          >
            {saveStatus === "saving" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            {saveStatus === "saved" ? <Check className="size-3.5 text-emerald-600" aria-hidden /> : null}
            {saveStatus === "error" ? <CloudOff className="size-3.5" aria-hidden /> : null}
            {saveLabel}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Mode</span>
        {modes.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setThinkingMode(id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              thinkingMode === id
                ? modeAccent[id]
                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
        <Button type="button" size="sm" onClick={() => addIdeaNode()} className="gap-1">
          <Plus className="size-4" />
          Add idea
        </Button>
      </div>
    </div>
  );
}
