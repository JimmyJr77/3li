import { useQuery } from "@tanstack/react-query";
import { Bell, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchActivityFeed, fetchBootstrap } from "@/features/taskflow/api";
import type { ActivityFeedItem } from "@/features/taskflow/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function matchesActivitySearch(row: ActivityFeedItem, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [
    row.action,
    row.detail,
    row.task.title,
    row.task.list.board.name,
    row.task.list.title,
    new Date(row.createdAt).toLocaleString(),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(s);
}

export function NotificationsPage() {
  const bootstrapQuery = useQuery({
    queryKey: ["bootstrap"],
    queryFn: fetchBootstrap,
  });

  const workspaceId = bootstrapQuery.data?.workspace?.id;
  const defaultBoardId = bootstrapQuery.data?.board?.id;

  const feedQuery = useQuery({
    queryKey: ["activity-feed", workspaceId],
    queryFn: () => fetchActivityFeed(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  const rows = feedQuery.data ?? [];
  const loading = bootstrapQuery.isLoading || (Boolean(workspaceId) && feedQuery.isLoading);

  const [search, setSearch] = useState("");

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesActivitySearch(row, search)),
    [rows, search],
  );

  return (
    <div className="w-full space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-muted-foreground" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent task events across your workspace. Open a task from the{" "}
          <Link
            to={defaultBoardId ? `/app/boards/${defaultBoardId}` : "/app/boards"}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            board
          </Link>{" "}
          to continue working.
        </p>
      </div>

      <div className="max-w-xl space-y-1">
        <Label htmlFor="activity-search" className="text-xs text-muted-foreground">
          Search activity
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="activity-search"
            type="search"
            placeholder="Filter by action, task, board, list, or date…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            autoComplete="off"
            aria-label="Search activity"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      )}
      {feedQuery.isError && (
        <p className="text-sm text-destructive">Could not load activity. Is the API running?</p>
      )}

      <ul className="divide-y rounded-xl border bg-card">
        {rows.length === 0 && !loading && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            No activity yet. Create or move tasks on a board to see the feed.
          </li>
        )}
        {rows.length > 0 && filteredRows.length === 0 && !loading && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            No activity matches &ldquo;{search.trim()}&rdquo;. Try a different search.
          </li>
        )}
        {filteredRows.map((row) => (
          <li key={row.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium capitalize">{row.action}</span>
              <time className="text-xs text-muted-foreground">
                {new Date(row.createdAt).toLocaleString()}
              </time>
            </div>
            <p className="text-muted-foreground">
              <span className="text-foreground">{row.task.title}</span>
              {row.detail ? ` — ${row.detail}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.task.list.board.name} · {row.task.list.title}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
