import { useQuery } from "@tanstack/react-query";
import { ExternalLink, GripVertical, History, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Link } from "react-router-dom";
import type { AgentDirectoryEntry } from "@/features/agents/agentDirectory";
import { agentDirectory } from "@/features/agents/agentDirectory";
import { fetchAgentSessionDetail, fetchAgentSessionsList, type AgentSessionEventDto } from "@/features/agents/agentSessionsApi";
import type { ChatBootstrap, ChatMessage, ChatThreadListItem } from "@/features/chat/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetDialog,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
} from "@/components/ui/sheet";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

function fmtShort(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const LEFT_WIDTH_DEFAULT = 360;
const RIGHT_WIDTH_DEFAULT = 560;
const WIDTH_MIN = 300;
const WIDTH_MAX = 720;

function readStoredPanelWidth(storageKey: string, defaultW: number): number {
  if (typeof window === "undefined") return defaultW;
  try {
    const raw = localStorage.getItem(storageKey);
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= WIDTH_MIN && n <= WIDTH_MAX) return n;
  } catch {
    /* ignore */
  }
  return defaultW;
}

function useResizablePanelWidth(storageKey: string, defaultW: number) {
  const [w, setW] = useState(() => readStoredPanelWidth(storageKey, defaultW));
  const wRef = useRef(w);
  useEffect(() => {
    wRef.current = w;
  }, [w]);

  const startResize = useCallback(
    (e: ReactMouseEvent, side: "left" | "right") => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = wRef.current;
      const onMove = (ev: MouseEvent) => {
        const dx = side === "left" ? ev.clientX - startX : startX - ev.clientX;
        const cap = Math.min(WIDTH_MAX, typeof window !== "undefined" ? window.innerWidth - 24 : WIDTH_MAX);
        const next = Math.min(cap, Math.max(WIDTH_MIN, startW + dx));
        wRef.current = next;
        setW(next);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        try {
          localStorage.setItem(storageKey, String(wRef.current));
        } catch {
          /* ignore */
        }
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [storageKey],
  );

  return { widthPx: w, startResize };
}

function eventSummary(ev: AgentSessionEventDto): string {
  const p = ev.payload && typeof ev.payload === "object" ? (ev.payload as Record<string, unknown>) : {};
  if (ev.type === "user_message" && typeof p.text === "string") return p.text;
  if (ev.type === "assistant_message" && typeof p.text === "string") return p.text;
  if (ev.type === "brainstorm_ai_turn") {
    const pr = typeof p.prompt === "string" ? p.prompt : "";
    return pr.slice(0, 200);
  }
  if (ev.type.startsWith("mail_clerk")) {
    const ex = typeof p.executiveSummary === "string" ? p.executiveSummary : "";
    return ex.slice(0, 200);
  }
  return ev.type;
}

function AgentEventsTimeline({ events }: { events: AgentSessionEventDto[] }) {
  return (
    <div className="space-y-4 pr-2">
      {events.map((ev) => (
        <div key={ev.id} className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-sm">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{ev.type}</span>
            <time dateTime={ev.createdAt}>{fmtShort(ev.createdAt)}</time>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-foreground/90">{eventSummary(ev)}</p>
        </div>
      ))}
    </div>
  );
}

function ConsultantReadOnly({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="space-y-3 pr-2">
      {messages.map((m) => (
        <div
          key={m.id}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm",
            m.role === "user" ? "border-primary/25 bg-primary/5" : "border-border/70 bg-muted/25",
          )}
        >
          <div className="text-xs font-medium text-muted-foreground">{m.role}</div>
          <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
        </div>
      ))}
    </div>
  );
}

type HubShellProps = {
  workspaceId: string | null | undefined;
};

export function DashboardAgentHubShell({ workspaceId }: HubShellProps) {
  const [entry, setEntry] = useState<AgentDirectoryEntry | null>(null);
  const [hubOpen, setHubOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const leftPanel = useResizablePanelWidth("dashboardAgentHubLeftW", LEFT_WIDTH_DEFAULT);
  const rightPanel = useResizablePanelWidth("dashboardAgentHubRightW", RIGHT_WIDTH_DEFAULT);

  const openForEntry = useCallback((e: AgentDirectoryEntry) => {
    setEntry(e);
    setSessionId(null);
    setHubOpen(true);
  }, []);

  const onHubOpenChange = useCallback((open: boolean) => {
    setHubOpen(open);
    if (!open) {
      setEntry(null);
      setSessionId(null);
    }
  }, []);

  const { data: boot } = useQuery({
    queryKey: ["chat-bootstrap"],
    queryFn: async () => {
      const res = await api.get<ChatBootstrap>("/api/chat/bootstrap");
      return res.data;
    },
    enabled: Boolean(workspaceId && hubOpen && entry?.sessionSource === "chat_threads"),
  });

  const projectId = useMemo(() => {
    if (!boot || !workspaceId) return null;
    return boot.projectIdByWorkspaceId?.[workspaceId] ?? boot.defaultProjectId;
  }, [boot, workspaceId]);

  const threadsQuery = useQuery({
    queryKey: ["chat-threads", projectId],
    enabled: Boolean(hubOpen && entry?.sessionSource === "chat_threads" && projectId),
    queryFn: async () => {
      const res = await api.get<ChatThreadListItem[]>("/api/chat/threads", { params: { projectId: projectId! } });
      return res.data;
    },
  });

  const agentSessionsQuery = useQuery({
    queryKey: ["agent-sessions", workspaceId, entry?.listAgentKind],
    enabled: Boolean(
      hubOpen && workspaceId && entry?.sessionSource === "agent_sessions" && entry.listAgentKind,
    ),
    queryFn: () => fetchAgentSessionsList(workspaceId!, entry!.listAgentKind!),
  });

  const threads = useMemo(() => threadsQuery.data ?? [], [threadsQuery.data]);
  const agentSessions = useMemo(() => agentSessionsQuery.data ?? [], [agentSessionsQuery.data]);

  const firstListId = useMemo(() => {
    if (!entry) return null;
    if (entry.sessionSource === "chat_threads" && threads.length > 0) return threads[0]!.id;
    if (entry.sessionSource === "agent_sessions" && agentSessions.length > 0) return agentSessions[0]!.id;
    return null;
  }, [entry, threads, agentSessions]);

  const activeSessionId = sessionId ?? firstListId;

  const threadDetailQuery = useQuery({
    queryKey: ["chat-thread", activeSessionId],
    enabled: Boolean(hubOpen && entry?.sessionSource === "chat_threads" && activeSessionId),
    queryFn: async () => {
      const res = await api.get<{ messages: ChatMessage[]; title: string }>(
        `/api/chat/threads/${activeSessionId}`,
      );
      return res.data;
    },
  });

  const agentDetailQuery = useQuery({
    queryKey: ["agent-session", workspaceId, activeSessionId],
    enabled: Boolean(hubOpen && entry?.sessionSource === "agent_sessions" && workspaceId && activeSessionId),
    queryFn: () => fetchAgentSessionDetail(workspaceId!, activeSessionId!),
  });

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {agentDirectory.map((row) => {
          const Icon = row.icon;
          return (
            <button
              key={`${row.kind}-${row.label}`}
              type="button"
              onClick={() => openForEntry(row)}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-xs transition-colors hover:bg-muted/40"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                <Icon className="size-4 text-muted-foreground" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{row.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{row.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <Sheet open={hubOpen} onOpenChange={onHubOpenChange}>
        <SheetPortal>
          <SheetOverlay className="z-50" />
          <SheetDialog.Content
            className={cn(
              "fixed inset-0 z-50 flex max-h-none min-h-0 max-w-none !w-full flex-row gap-0 border-0 bg-transparent p-0 shadow-none outline-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200",
            )}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <SheetDialog.Title className="sr-only">
              {entry ? `${entry.label} — sessions and history` : "Agent sessions and history"}
            </SheetDialog.Title>
            <SheetDialog.Description className="sr-only">
              Choose a session on the left and read its history on the right.
            </SheetDialog.Description>

            <div
              className="flex h-full max-h-[100dvh] min-h-0 w-full min-w-0 flex-1 flex-row overscroll-contain"
              data-agent-hub-dual-pane
            >
              <div
                className="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-border bg-popover text-sm text-popover-foreground shadow-xl"
                style={{ width: `min(${leftPanel.widthPx}px, calc(100vw - 12px))` }}
              >
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Drag to resize panel"
                  title="Drag to resize"
                  className="absolute top-0 right-0 bottom-0 z-20 flex w-4 cursor-col-resize touch-none items-center justify-center border-l border-transparent hover:border-border hover:bg-muted/50 active:bg-muted"
                  onMouseDown={(e) => leftPanel.startResize(e, "left")}
                >
                  <GripVertical className="size-4 text-muted-foreground opacity-70" aria-hidden />
                </div>
                <SheetHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-8">
                  <div className="font-heading text-base font-medium text-foreground">Sessions</div>
                  <p className="text-xs text-muted-foreground">
                    {entry ? `${entry.label} — pick a session to review.` : ""}
                  </p>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pr-6">
                  {!workspaceId ? (
                    <p className="px-2 text-sm text-muted-foreground">Select a workspace to load sessions.</p>
                  ) : entry?.sessionSource === "chat_threads" ? (
                    threadsQuery.isLoading ? (
                      <p className="px-2 text-sm text-muted-foreground">Loading chats…</p>
                    ) : threads.length === 0 ? (
                      <p className="px-2 text-sm text-muted-foreground">No consultant threads yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {threads.map((t) => (
                          <li key={t.id}>
                            <button
                              type="button"
                              onClick={() => setSessionId(t.id)}
                              className={cn(
                                "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                                activeSessionId === t.id ?
                                  "border-primary/40 bg-primary/10"
                                : "border-transparent hover:bg-muted/60",
                              )}
                            >
                              <span className="font-medium line-clamp-2">{t.title}</span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {t._count.messages} messages · {fmtShort(t.updatedAt)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : agentSessionsQuery.isLoading ? (
                    <p className="px-2 text-sm text-muted-foreground">Loading sessions…</p>
                  ) : agentSessions.length === 0 ? (
                    <p className="px-2 text-sm text-muted-foreground">
                      No saved sessions yet. Use the agent, then return here.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {agentSessions.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => setSessionId(s.id)}
                            className={cn(
                              "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                              activeSessionId === s.id ?
                                "border-primary/40 bg-primary/10"
                              : "border-transparent hover:bg-muted/60",
                            )}
                          >
                            <span className="font-medium line-clamp-2">{s.title}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                              {s.preview || "—"} · {fmtShort(s.updatedAt)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="min-h-0 min-w-0 flex-1 bg-transparent" aria-hidden />

              <div
                className="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-border bg-popover text-sm text-popover-foreground shadow-xl"
                style={{ width: `min(${rightPanel.widthPx}px, calc(100vw - 12px))` }}
              >
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Drag to resize panel"
                  title="Drag to resize"
                  className="absolute top-0 bottom-0 left-0 z-20 flex w-4 cursor-col-resize touch-none items-center justify-center border-r border-transparent hover:border-border hover:bg-muted/50 active:bg-muted"
                  onMouseDown={(e) => rightPanel.startResize(e, "right")}
                >
                  <GripVertical className="size-4 text-muted-foreground opacity-70" aria-hidden />
                </div>
                <SheetClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-3 right-3 z-30"
                    aria-label="Close agent hub"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </SheetClose>
                <SheetHeader className="shrink-0 border-b border-border/60 px-6 py-4 pl-10 pr-12">
                  <div className="flex items-center gap-2">
                    <History className="size-4 text-muted-foreground" aria-hidden />
                    <div className="font-heading text-base font-medium text-foreground">
                      {entry ? `${entry.label} history` : "History"}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Read-only transcript or action log.</p>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pl-10">
                  {!entry || !workspaceId ? null : !activeSessionId ? (
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p>No sessions yet. Open the agent to create history.</p>
                      <Button type="button" variant="secondary" size="sm" asChild>
                        <Link to={entry.livePath}>
                          <ExternalLink className="mr-1.5 size-3.5" aria-hidden />
                          Open {entry.label}
                        </Link>
                      </Button>
                    </div>
                  ) : entry.sessionSource === "chat_threads" ? (
                    threadDetailQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">Loading messages…</p>
                    ) : (
                      <ConsultantReadOnly messages={threadDetailQuery.data?.messages ?? []} />
                    )
                  ) : agentDetailQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading events…</p>
                  ) : (
                    <AgentEventsTimeline events={agentDetailQuery.data?.events ?? []} />
                  )}
                  {entry && activeSessionId ? (
                    <div className="mt-6 border-t border-border/60 pt-4">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link to={entry.livePath}>
                          Continue in {entry.label}
                          <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </SheetDialog.Content>
        </SheetPortal>
      </Sheet>
    </>
  );
}
