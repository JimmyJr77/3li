import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Maximize2, Plus, Save, Trash2 } from "lucide-react";
import { BrainstormCanvasTools } from "@/features/brainstorm/components/BrainstormCanvasTools";
import { useEffect, useState } from "react";
import {
  createBrainstormSession,
  deleteBrainstormSession,
  patchBrainstormSession,
  type BrainstormSessionSummary,
} from "@/features/brainstorm/api";
import { useBrainstormStore } from "@/features/brainstorm/stores/brainstormStore";
import { workspaceCtaMatchSidebarActiveDark } from "@/components/layout/workspaceCtaChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type BrainstormSessionBarProps = {
  workspaceId: string;
  sessions: BrainstormSessionSummary[];
  activeSessionId: string;
  onSessionChange: (sessionId: string) => void;
  onCreatedSession: (sessionId: string) => void;
  onSaveBoard?: () => void;
  saveBoardDisabled?: boolean;
};

export function BrainstormSessionBar({
  workspaceId,
  sessions,
  activeSessionId,
  onSessionChange,
  onCreatedSession,
  onSaveBoard,
  saveBoardDisabled = true,
}: BrainstormSessionBarProps) {
  const queryClient = useQueryClient();
  const presentationMode = useBrainstormStore((s) => s.presentationMode);
  const togglePresentationMode = useBrainstormStore((s) => s.togglePresentationMode);
  const active = sessions.find((s) => s.id === activeSessionId);
  const [titleDraft, setTitleDraft] = useState(active?.title ?? "");

  useEffect(() => {
    setTitleDraft(active?.title ?? "");
  }, [active?.id, active?.title]);

  const createMutation = useMutation({
    mutationFn: () => createBrainstormSession(workspaceId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["brainstorm", "sessions-list"] });
      onCreatedSession(data.session.id);
    },
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      patchBrainstormSession(id, { title }, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brainstorm", "sessions-list"] });
      queryClient.invalidateQueries({ queryKey: ["brainstorm", "session"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBrainstormSession(id, workspaceId),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["brainstorm", "sessions-list"] });
      const remaining = sessions.filter((s) => s.id !== deletedId);
      if (remaining[0]) {
        onSessionChange(remaining[0].id);
      }
    },
  });

  const handleTitleBlur = () => {
    const t = titleDraft.trim();
    if (!active || !t || t === active.title) {
      setTitleDraft(active?.title ?? "");
      return;
    }
    patchMutation.mutate({ id: active.id, title: t });
  };

  const busy = createMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1.5 sm:max-w-[min(100%,22rem)] sm:shrink-0">
          <label htmlFor="brainstorm-session" className="text-xs font-medium text-muted-foreground">
            Studio board
          </label>
          <select
            id="brainstorm-session"
            value={activeSessionId}
            onChange={(e) => onSessionChange(e.target.value)}
            className="h-9 w-full rounded-md border border-primary/28 bg-white px-2 text-sm text-foreground shadow-sm outline-none dark:border-input dark:bg-input/30 dark:shadow-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.nodeCount} ideas)
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="brainstorm-session-title" className="text-xs font-medium text-muted-foreground">
            Board title
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              id="brainstorm-session-title"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              disabled={!active || patchMutation.isPending}
              className="h-9 min-w-[12rem] flex-1 border-primary/28 bg-white text-foreground shadow-sm disabled:bg-muted/50 dark:border-input dark:bg-input/30 dark:shadow-none dark:disabled:bg-input/80"
              placeholder="Name this studio board"
            />
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {onSaveBoard ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || saveBoardDisabled}
                  className="gap-1"
                  onClick={() => onSaveBoard()}
                >
                  <Save className="size-4" aria-hidden />
                  Save board
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                className="gap-1 shrink-0 self-end sm:self-auto"
                title={presentationMode ? "Leave full screen board view" : "Expand the studio board to full screen"}
                onClick={() => togglePresentationMode()}
              >
                <Maximize2 className="size-4" aria-hidden />
                {presentationMode ? "Exit full screen" : "Full screen"}
              </Button>
              <Button
                type="button"
                className={cn("gap-1 shrink-0 self-end sm:self-auto", workspaceCtaMatchSidebarActiveDark)}
                disabled={busy}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                New board
              </Button>
              {sessions.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  className="text-destructive hover:bg-destructive/10 gap-1"
                  onClick={() => {
                    if (window.confirm("Delete this studio board and its canvas? This cannot be undone.")) {
                      deleteMutation.mutate(activeSessionId);
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      {!presentationMode ? (
        <div className="flex flex-wrap justify-end gap-2">
          <BrainstormCanvasTools />
        </div>
      ) : null}
    </div>
  );
}
