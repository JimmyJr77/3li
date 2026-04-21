import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  Check,
  Goal,
  LayoutGrid,
  Lightbulb,
  Loader2,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RapidRouterIcon } from "@/components/shared/RapidRouterIcon";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { appendIdeaToBrainstorm } from "@/features/rapidRouter/appendBrainstormIdea";
import { fetchBrainstormSessionsList } from "@/features/brainstorm/api";
import {
  createBoardTask,
  fetchBoard,
  fetchBootstrap,
  fetchWorkspaces,
} from "@/features/taskflow/api";
import { createNote, fetchNotesBootstrap } from "@/features/notes/api";
import { extractPreviewFromDoc } from "@/features/notes/extractPreview";
import { plainTextToTipTapDoc } from "@/features/notes/noteUtils";
import { cn } from "@/lib/utils";

const STICKIES_STORAGE_KEY = "atlas.rapidRouter.stickies.v1";
const BRAND_CENTER_STORAGE_KEY = "atlas.rapidRouter.brandCenter.v1";

type Destination = "brandCenter" | "notes" | "brainstorm" | "boards";

type RapidSticky = {
  id: string;
  body: string;
};

const STICKY_SHELL =
  "border shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring/40";

const STICKY_PALETTE = [
  "bg-amber-50 border-amber-200/80 dark:bg-amber-950/35 dark:border-amber-800/60",
  "bg-sky-50 border-sky-200/80 dark:bg-sky-950/35 dark:border-sky-800/60",
  "bg-lime-50 border-lime-200/80 dark:bg-lime-950/30 dark:border-lime-800/60",
  "bg-rose-50 border-rose-200/80 dark:bg-rose-950/35 dark:border-rose-800/60",
];

function loadStickies(): RapidSticky[] {
  try {
    const raw = localStorage.getItem(STICKIES_STORAGE_KEY);
    if (!raw) return [{ id: crypto.randomUUID(), body: "" }];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [{ id: crypto.randomUUID(), body: "" }];
    return parsed
      .filter((x): x is RapidSticky => x && typeof x === "object" && typeof (x as RapidSticky).id === "string")
      .map((s) => ({ id: s.id, body: typeof s.body === "string" ? s.body : "" }));
  } catch {
    return [{ id: crypto.randomUUID(), body: "" }];
  }
}

function persistStickies(stickies: RapidSticky[]) {
  try {
    localStorage.setItem(STICKIES_STORAGE_KEY, JSON.stringify(stickies));
  } catch {
    /* ignore quota */
  }
}

function splitTaskTitleDescription(raw: string): { title: string; description: string } {
  const nl = raw.indexOf("\n");
  const title = (nl === -1 ? raw : raw.slice(0, nl)).trim().slice(0, 500) || raw.slice(0, 500);
  const description = nl === -1 ? "" : raw.slice(nl + 1).trim().slice(0, 20000);
  return { title, description };
}

export function RapidRouterPage() {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [destination, setDestination] = useState<Destination>("boards");
  const [captureOk, setCaptureOk] = useState<string | null>(null);
  const [stickies, setStickies] = useState<RapidSticky[]>(() => loadStickies());

  const [boardsBoardId, setBoardsBoardId] = useState<string | null>(null);
  const [boardsListId, setBoardsListId] = useState<string | null>(null);
  const [notesFolderId, setNotesFolderId] = useState<string | null>(null);
  const [brainstormSessionId, setBrainstormSessionId] = useState<string | null>(null);

  useEffect(() => {
    persistStickies(stickies);
  }, [stickies]);

  const bootstrapQuery = useQuery({
    queryKey: ["bootstrap"],
    queryFn: fetchBootstrap,
  });

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: fetchWorkspaces,
  });

  const notesBootstrapQuery = useQuery({
    queryKey: ["notes-app", "bootstrap"],
    queryFn: fetchNotesBootstrap,
  });

  const brainstormSessionsQuery = useQuery({
    queryKey: ["brainstorm", "sessions-list"],
    queryFn: fetchBrainstormSessionsList,
  });

  const defaultBoardId = bootstrapQuery.data?.board?.id ?? null;

  useEffect(() => {
    if (!defaultBoardId) return;
    setBoardsBoardId((prev) => prev ?? defaultBoardId);
  }, [defaultBoardId]);

  useEffect(() => {
    const def = notesBootstrapQuery.data?.defaultFolderId;
    if (def) setNotesFolderId((prev) => prev ?? def);
  }, [notesBootstrapQuery.data?.defaultFolderId]);

  useEffect(() => {
    const id = brainstormSessionsQuery.data?.sessions[0]?.id;
    if (id) setBrainstormSessionId((prev) => prev ?? id);
  }, [brainstormSessionsQuery.data?.sessions]);

  const boardsBoardQuery = useQuery({
    queryKey: ["board", boardsBoardId],
    queryFn: () => fetchBoard(boardsBoardId!),
    enabled: destination === "boards" && Boolean(boardsBoardId),
  });

  useEffect(() => {
    const board = boardsBoardQuery.data;
    if (!board?.lists.length) return;
    const backlog = board.lists.find((l) => l.key === "backlog")?.id ?? board.lists[0]?.id;
    if (backlog) setBoardsListId(backlog);
  }, [boardsBoardId, boardsBoardQuery.data]);

  const flatBoards = useMemo(() => {
    const ws = workspacesQuery.data ?? [];
    return ws.flatMap((w) =>
      w.boards.map((b) => ({
        id: b.id,
        name: b.name,
        workspaceName: w.name,
      })),
    );
  }, [workspacesQuery.data]);

  const notesReady = notesBootstrapQuery.data?.workspace?.id && notesBootstrapQuery.data.defaultFolderId;
  const notesFolders = notesBootstrapQuery.data?.folders ?? [];
  const brainstormSessions = brainstormSessionsQuery.data?.sessions ?? [];

  const captureMutation = useMutation({
    mutationFn: async () => {
      const raw = text.trim();
      if (!raw) throw new Error("empty");

      if (destination === "brandCenter") {
        try {
          const prevRaw = localStorage.getItem(BRAND_CENTER_STORAGE_KEY);
          const prev = prevRaw ? (JSON.parse(prevRaw) as unknown) : [];
          const arr = Array.isArray(prev) ? prev : [];
          const entry = { id: crypto.randomUUID(), text: raw, createdAt: new Date().toISOString() };
          localStorage.setItem(BRAND_CENTER_STORAGE_KEY, JSON.stringify([entry, ...arr]));
        } catch {
          throw new Error("brand-storage");
        }
        return "brandCenter" as const;
      }

      if (destination === "notes") {
        const ws = notesBootstrapQuery.data?.workspace.id;
        const folderId = notesFolderId ?? notesBootstrapQuery.data?.defaultFolderId;
        if (!ws || !folderId) throw new Error("no-notes");
        const doc = plainTextToTipTapDoc(raw);
        const preview = extractPreviewFromDoc(doc);
        const titleLine = raw.split("\n")[0]?.trim() || "Rapid note";
        await createNote({
          workspaceId: ws,
          folderId,
          title: titleLine.slice(0, 500),
          contentJson: doc,
          previewText: preview || null,
        });
        return "notes" as const;
      }

      if (destination === "brainstorm") {
        await appendIdeaToBrainstorm(raw, brainstormSessionId);
        return "brainstorm" as const;
      }

      if (destination === "boards") {
        if (!boardsBoardId || !boardsListId) throw new Error("no-board-target");
        const { title, description } = splitTaskTitleDescription(raw);
        await createBoardTask(boardsBoardId, {
          listId: boardsListId,
          title,
          ...(description ? { description } : {}),
        });
        return "boards" as const;
      }

      throw new Error("unknown-destination");
    },
    onSuccess: (where) => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["board"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      queryClient.invalidateQueries({ queryKey: ["notes-app"] });
      queryClient.invalidateQueries({ queryKey: ["brainstorm"] });
      const label =
        where === "brandCenter"
          ? "Brand Center (this device)"
          : where === "notes"
            ? "Notebooks"
            : where === "brainstorm"
              ? "Brainstorm Studio"
              : "Board";
      setCaptureOk(`Sent to ${label}.`);
      window.setTimeout(() => setCaptureOk(null), 3200);
    },
  });

  const send = useCallback(() => {
    captureMutation.mutate();
  }, [captureMutation]);

  const sendCaptureToSticky = useCallback(() => {
    const raw = text.trim();
    if (!raw) return;
    setStickies((prev) => [...prev, { id: crypto.randomUUID(), body: raw }]);
    setText("");
    setCaptureOk("Added to sticky notes.");
    window.setTimeout(() => setCaptureOk(null), 2200);
  }, [text]);

  const canSend =
    text.trim().length > 0 &&
    !captureMutation.isPending &&
    (destination === "brandCenter" ||
      (destination === "notes" && !!notesReady && !!notesFolderId) ||
      (destination === "brainstorm" && !brainstormSessionsQuery.isLoading) ||
      (destination === "boards" && !!boardsBoardId && !!boardsListId));

  const selectClass =
    "border-input bg-background h-9 w-full rounded-md border px-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex items-center gap-2">
        <RapidRouterIcon className="size-7 shrink-0 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Rapid Router</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Write in Capture, optionally push a sticky into the box with the arrow control, route to a workspace
        destination, or send the capture into a local sticky note.
      </p>

      {bootstrapQuery.isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading workspace…
        </div>
      )}

      {notesBootstrapQuery.isError && (
        <p className="text-sm text-muted-foreground">
          Notebooks routing may be unavailable until the notes workspace loads.
        </p>
      )}

      <section className="space-y-3">
        <Label htmlFor="rapid-capture" className="text-foreground">
          Capture
        </Label>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) send();
          }}
        >
          <textarea
            id="rapid-capture"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (canSend) send();
              }
            }}
            placeholder="Type freely. First line is often used as a title for tasks and notes."
            rows={6}
            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          />

          <div>
            <Button type="button" variant="secondary" size="sm" onClick={sendCaptureToSticky} disabled={!text.trim()}>
              <StickyNote className="mr-2 size-4" aria-hidden />
              Send to Sticky Notes
            </Button>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Send to</span>
            <div className="flex flex-wrap gap-2">
              <DestinationChip
                active={destination === "brandCenter"}
                onClick={() => setDestination("brandCenter")}
                icon={Goal}
                label="Brand Center"
              />
              <DestinationChip
                active={destination === "notes"}
                disabled={!notesReady}
                onClick={() => setDestination("notes")}
                icon={StickyNote}
                label="Notebooks"
              />
              <DestinationChip
                active={destination === "brainstorm"}
                disabled={brainstormSessionsQuery.isLoading}
                onClick={() => setDestination("brainstorm")}
                icon={Lightbulb}
                label="Brainstorm Studio"
              />
              <DestinationChip
                active={destination === "boards"}
                disabled={!flatBoards.length}
                onClick={() => setDestination("boards")}
                icon={LayoutGrid}
                label="Project Boards"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
            {destination === "brandCenter" && (
              <p className="text-sm text-muted-foreground">
                Saves to Brand Center on this device until the Brand Center workspace is connected.
              </p>
            )}

            {destination === "boards" && workspacesQuery.isSuccess && flatBoards.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No project boards found — create one under Project Boards first.
              </p>
            )}

            {destination === "notes" && notesReady && (
              <div className="space-y-1.5">
                <Label htmlFor="rr-notes-folder">Folder</Label>
                <select
                  id="rr-notes-folder"
                  className={selectClass}
                  value={notesFolderId ?? ""}
                  onChange={(e) => setNotesFolderId(e.target.value || null)}
                >
                  {notesFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {destination === "brainstorm" && (
              <div className="space-y-2">
                {brainstormSessions.length > 0 ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="rr-brainstorm-session">Session</Label>
                    <select
                      id="rr-brainstorm-session"
                      className={selectClass}
                      value={brainstormSessionId ?? ""}
                      onChange={(e) => setBrainstormSessionId(e.target.value || null)}
                    >
                      {brainstormSessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} ({s.nodeCount} nodes)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No session yet — one will be created automatically when you send.
                  </p>
                )}
              </div>
            )}

            {destination === "boards" && flatBoards.length > 0 && (
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                <div className="min-w-[200px] flex-1 space-y-1.5">
                  <Label htmlFor="rr-boards-board">Project board</Label>
                  <select
                    id="rr-boards-board"
                    className={selectClass}
                    value={boardsBoardId ?? ""}
                    onChange={(e) => {
                      setBoardsBoardId(e.target.value || null);
                      setBoardsListId(null);
                    }}
                  >
                    {flatBoards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} — {b.workspaceName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[200px] flex-1 space-y-1.5">
                  <Label htmlFor="rr-boards-list">List</Label>
                  <select
                    id="rr-boards-list"
                    className={selectClass}
                    value={boardsListId ?? ""}
                    onChange={(e) => setBoardsListId(e.target.value || null)}
                    disabled={!boardsBoardQuery.data?.lists.length}
                  >
                    {(boardsBoardQuery.data?.lists ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <Button type="submit" disabled={!canSend} className="w-full sm:w-auto">
              {captureMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <RapidRouterIcon className="mr-2 size-4" />
                  Send
                </>
              )}
            </Button>
          </div>

          {captureMutation.isError && (
            <p className="text-sm text-destructive">Could not send. Check your connection and try again.</p>
          )}
          {captureOk && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="size-4 shrink-0" aria-hidden />
              {captureOk}
            </p>
          )}
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <StickyNote className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold tracking-tight">Sticky notes</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Quick scratch cards stored in this browser — not synced to the server. Use the arrow to copy into Capture.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {stickies.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "rounded-lg p-0.5",
                STICKY_SHELL,
                STICKY_PALETTE[i % STICKY_PALETTE.length],
              )}
            >
              <div className="flex items-center gap-1.5 border-b border-border/40 px-2 py-1.5">
                <span className="min-w-0 flex-1 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Note {i + 1}
                </span>
                <button
                  type="button"
                  title="Send to Capture"
                  aria-label="Send sticky to Capture"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border/80 bg-transparent text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                  onClick={() => {
                    setText((prev) => {
                      const t = s.body.trim();
                      if (!t) return prev;
                      return prev.trim() ? `${prev.trim()}\n\n${t}` : t;
                    });
                  }}
                >
                  <ArrowUp className="size-3" aria-hidden />
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Remove sticky"
                  onClick={() => {
                    setStickies((prev) => {
                      const next = prev.filter((x) => x.id !== s.id);
                      return next.length ? next : [{ id: crypto.randomUUID(), body: "" }];
                    });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <textarea
                value={s.body}
                onChange={(e) => {
                  const v = e.target.value;
                  setStickies((prev) => prev.map((x) => (x.id === s.id ? { ...x, body: v } : x)));
                }}
                placeholder="Jot something…"
                rows={5}
                className="w-full resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground/70"
              />
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => setStickies((prev) => [...prev, { id: crypto.randomUUID(), body: "" }])}
        >
          Add sticky
        </Button>
      </section>
    </div>
  );
}

function DestinationChip({
  active,
  disabled,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: typeof Goal;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        disabled && "cursor-not-allowed opacity-50",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}
