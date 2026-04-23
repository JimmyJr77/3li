import { Bot, Check, CloudOff, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BrainstormSaveStatus } from "@/features/brainstorm/saveStatus";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";

type BrainstormToolbarProps = {
  saveStatus?: BrainstormSaveStatus;
};

export function BrainstormToolbar({ saveStatus = "idle" }: BrainstormToolbarProps) {
  const agentsPanelVisible = useBrainstormStore((s) => s.agentsPanelVisible);
  const setAgentsPanelVisible = useBrainstormStore((s) => s.setAgentsPanelVisible);

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
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Brainstorm Studio</h1>
      </div>
      {saveLabel && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
            saveStatus === "saved" &&
              "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 vibrant:border-emerald-500/55 vibrant:bg-emerald-500/14 vibrant:text-emerald-900 rainbow-explosion:border-emerald-500/80 rainbow-explosion:bg-emerald-500/22 rainbow-explosion:text-emerald-950",
            saveStatus === "saving" && "border-border bg-muted/60 text-muted-foreground",
            saveStatus === "pending" &&
              "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100 vibrant:border-amber-500/55 vibrant:bg-amber-500/14 vibrant:text-amber-950 rainbow-explosion:border-amber-500/80 rainbow-explosion:bg-amber-500/22 rainbow-explosion:text-amber-950",
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
      <Button
        type="button"
        variant={agentsPanelVisible ? "secondary" : "outline"}
        size="sm"
        className="ml-auto shrink-0 gap-1.5"
        onClick={() => setAgentsPanelVisible(!agentsPanelVisible)}
        aria-pressed={agentsPanelVisible}
      >
        <Bot className="size-4" aria-hidden />
        Brainstorm Agents
      </Button>
    </div>
  );
}
