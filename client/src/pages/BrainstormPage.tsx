import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchBrainstormSessionsList } from "@/features/brainstorm/api";
import { BrainstormCanvas } from "@/features/brainstorm/components/BrainstormCanvas";
import { BrainstormSessionBar } from "@/features/brainstorm/components/BrainstormSessionBar";
import { BrainstormToolbar } from "@/features/brainstorm/components/BrainstormToolbar";
import { BrainstormWorkspace } from "@/features/brainstorm/components/BrainstormWorkspace";
import type { BrainstormSaveStatus } from "@/features/brainstorm/saveStatus";
import { Button } from "@/components/ui/button";

export function BrainstormPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [saveStatus, setSaveStatus] = useState<BrainstormSaveStatus>("idle");

  const listQuery = useQuery({
    queryKey: ["brainstorm", "sessions-list"],
    queryFn: fetchBrainstormSessionsList,
    retry: 1,
  });

  const sessions = listQuery.data?.sessions ?? [];
  const sessionParam = searchParams.get("session");
  const matchesParam = sessionParam && sessions.some((s) => s.id === sessionParam);
  const activeSessionId = matchesParam ? sessionParam : (sessions[0]?.id ?? "");

  useEffect(() => {
    if (!listQuery.isSuccess || !activeSessionId) {
      return;
    }
    if (sessionParam !== activeSessionId) {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("session", activeSessionId);
          return p;
        },
        { replace: true },
      );
    }
  }, [listQuery.isSuccess, activeSessionId, sessionParam, setSearchParams]);

  const setSessionInUrl = (id: string) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("session", id);
      return p;
    });
    queryClient.invalidateQueries({ queryKey: ["brainstorm", "session", id] });
  };

  const listLoading = listQuery.isPending && !listQuery.data;

  if (listLoading) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-4">
        <BrainstormToolbar saveStatus="idle" />
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading sessions…
        </div>
      </div>
    );
  }

  if (listQuery.isError) {
    const detail =
      isAxiosError(listQuery.error) &&
      listQuery.error.response?.data &&
      typeof listQuery.error.response.data === "object" &&
      listQuery.error.response.data !== null &&
      "detail" in listQuery.error.response.data &&
      typeof (listQuery.error.response.data as { detail?: unknown }).detail === "string"
        ? (listQuery.error.response.data as { detail: string }).detail
        : null;

    return (
      <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-4">
        <BrainstormToolbar saveStatus="idle" />
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <p className="font-medium text-destructive">Could not load brainstorm sessions.</p>
          <p className="mt-1 text-muted-foreground">
            The dev server proxies <code className="text-xs">/api/*</code> to the API on port 3001. A 500 here
            usually means PostgreSQL is not configured or the schema is not applied: copy{" "}
            <code className="text-xs">.env.example</code> to <code className="text-xs">.env</code>, set{" "}
            <code className="text-xs">DATABASE_URL</code>, then run <code className="text-xs">npm run db:push</code>{" "}
            from the repo root.
          </p>
          {detail ? (
            <pre className="mt-3 max-h-40 overflow-auto rounded-md border bg-background/80 p-3 text-xs text-muted-foreground">
              {detail}
            </pre>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => listQuery.refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!activeSessionId) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-4">
        <BrainstormToolbar saveStatus="idle" />
        <p className="text-sm text-muted-foreground">No brainstorm sessions available. Try refreshing the page.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => listQuery.refetch()}>
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-1 flex-col gap-4">
      <BrainstormToolbar saveStatus={saveStatus} />
      <BrainstormSessionBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSessionChange={setSessionInUrl}
        onCreatedSession={setSessionInUrl}
      />
      <BrainstormWorkspace sessionId={activeSessionId} onSaveStatusChange={setSaveStatus}>
        <BrainstormCanvas />
      </BrainstormWorkspace>
    </div>
  );
}
