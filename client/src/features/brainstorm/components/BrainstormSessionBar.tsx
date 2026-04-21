import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createBrainstormSession,
  deleteBrainstormSession,
  patchBrainstormSession,
  type BrainstormSessionSummary,
} from "@/features/brainstorm/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BrainstormSessionBarProps = {
  sessions: BrainstormSessionSummary[];
  activeSessionId: string;
  onSessionChange: (sessionId: string) => void;
  onCreatedSession: (sessionId: string) => void;
};

export function BrainstormSessionBar({
  sessions,
  activeSessionId,
  onSessionChange,
  onCreatedSession,
}: BrainstormSessionBarProps) {
  const queryClient = useQueryClient();
  const active = sessions.find((s) => s.id === activeSessionId);
  const [titleDraft, setTitleDraft] = useState(active?.title ?? "");

  useEffect(() => {
    setTitleDraft(active?.title ?? "");
  }, [active?.id, active?.title]);

  const createMutation = useMutation({
    mutationFn: () => createBrainstormSession(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["brainstorm", "sessions-list"] });
      onCreatedSession(data.session.id);
    },
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => patchBrainstormSession(id, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brainstorm", "sessions-list"] });
      queryClient.invalidateQueries({ queryKey: ["brainstorm", "session"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBrainstormSession(id),
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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-md">
        <label htmlFor="brainstorm-session" className="text-xs font-medium text-muted-foreground">
          Session
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            id="brainstorm-session"
            value={activeSessionId}
            onChange={(e) => onSessionChange(e.target.value)}
            className="border-input bg-background h-9 min-w-[180px] flex-1 rounded-md border px-2 text-sm"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.nodeCount} ideas)
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            className="gap-1"
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            New session
          </Button>
          {sessions.length > 1 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              className="text-destructive hover:bg-destructive/10 gap-1"
              onClick={() => {
                if (window.confirm("Delete this session and its canvas? This cannot be undone.")) {
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
      <div className="flex min-w-0 flex-col gap-1 sm:max-w-xs">
        <label htmlFor="brainstorm-session-title" className="text-xs font-medium text-muted-foreground">
          Session title
        </label>
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
          className="h-9"
          placeholder="Name this brainstorm"
        />
      </div>
    </div>
  );
}
