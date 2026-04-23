import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Layers,
  Loader2,
  MessageSquarePlus,
  PanelRight,
  Presentation,
  Send,
  StopCircle,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { ChatChatsRail, ChatContextRail } from "@/features/chat/ChatWorkflowRails";
import { getRapidRouterBrandSnippets } from "@/features/brand/brandKitContext";
import { streamChatMessage } from "@/features/chat/streamChat";
import type {
  ChatBootstrap,
  ChatDocumentRow,
  ChatMessage,
  ChatThreadListItem,
  ConsultingMode,
} from "@/features/chat/types";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { api, resolveApiUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const MODES: { value: ConsultingMode; label: string }[] = [
  { value: "strategy", label: "Strategy" },
  { value: "financial", label: "Financial" },
  { value: "operations", label: "Operations" },
  { value: "technical", label: "Technical" },
];

type ThreadDetail = {
  id: string;
  title: string;
  consultingMode: string;
  workspaceId: string | null;
  messages: ChatMessage[];
  project: { id: string; name: string };
};

type TaskRow = {
  id: string;
  title: string;
  completed: boolean;
  list: { board: { id: string; name: string } };
};

export function ChatPage() {
  const { activeWorkspaceId } = useActiveWorkspace();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [mode, setMode] = useState<ConsultingMode>("strategy");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [lastCitations, setLastCitations] = useState<
    { ref: number; chunkId: string; filename: string }[]
  >([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [lastCompletedAssistantId, setLastCompletedAssistantId] = useState<string | null>(null);
  const [exportingDeck, setExportingDeck] = useState(false);
  const [localRelPath, setLocalRelPath] = useState("");
  const [localIngestBusy, setLocalIngestBusy] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [chatsOpen, setChatsOpen] = useState(true);
  const [contextOpen, setContextOpen] = useState(true);
  const isLg = useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );

  const { data: boot, isLoading: bootLoading } = useQuery({
    queryKey: ["chat-bootstrap"],
    queryFn: async () => {
      const res = await api.get<ChatBootstrap>("/api/chat/bootstrap");
      return res.data;
    },
  });

  useEffect(() => {
    if (!boot) {
      return;
    }
    const forWs =
      activeWorkspaceId && boot.projectIdByWorkspaceId?.[activeWorkspaceId] ?
        boot.projectIdByWorkspaceId[activeWorkspaceId]
      : boot.defaultProjectId;
    if (forWs && projectId === null) {
      setProjectId(forWs);
    }
  }, [boot, projectId, activeWorkspaceId]);

  useEffect(() => {
    if (!boot?.projectIdByWorkspaceId || !activeWorkspaceId) {
      return;
    }
    const next = boot.projectIdByWorkspaceId[activeWorkspaceId];
    if (next && next !== projectId) {
      setProjectId(next);
      setThreadId(null);
    }
  }, [activeWorkspaceId, boot?.projectIdByWorkspaceId, boot, projectId]);

  useEffect(() => {
    if (threadId != null) return;
    if (activeWorkspaceId) {
      setWorkspaceId(activeWorkspaceId);
    } else if (boot?.defaultWorkspaceId && workspaceId === null) {
      setWorkspaceId(boot.defaultWorkspaceId);
    }
  }, [boot, activeWorkspaceId, workspaceId, threadId]);

  const boardId = useMemo(() => {
    if (!boot) {
      return null;
    }
    if (!workspaceId) {
      return boot.defaultBoardId;
    }
    const ws = boot.workspaces.find((w) => w.id === workspaceId);
    return ws?.projectSpaces?.[0]?.boards?.[0]?.id ?? boot.defaultBoardId;
  }, [boot, workspaceId]);

  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ["chat-threads", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await api.get<ChatThreadListItem[]>("/api/chat/threads", {
        params: { projectId },
      });
      return res.data;
    },
  });

  const { data: threadDetail, isLoading: threadLoading } = useQuery({
    queryKey: ["chat-thread", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const res = await api.get<ThreadDetail>(`/api/chat/threads/${threadId}`);
      return res.data;
    },
  });

  useEffect(() => {
    if (threadDetail?.consultingMode) {
      const m = threadDetail.consultingMode as ConsultingMode;
      if (MODES.some((x) => x.value === m)) {
        setMode(m);
      }
    }
    if (threadDetail?.workspaceId !== undefined) {
      setWorkspaceId(threadDetail.workspaceId);
    }
  }, [threadDetail]);

  useEffect(() => {
    setLastCompletedAssistantId(null);
  }, [threadId]);

  const lastAssistantMessageIdFromThread = useMemo(() => {
    const msgs = threadDetail?.messages ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant") {
        return msgs[i].id;
      }
    }
    return undefined;
  }, [threadDetail?.messages]);

  const { data: documents = [] } = useQuery({
    queryKey: ["chat-docs", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await api.get<ChatDocumentRow[]>("/api/chat/documents", {
        params: { projectId },
      });
      return res.data;
    },
  });

  const { data: threadTasks = [] } = useQuery({
    queryKey: ["chat-thread-tasks", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const res = await api.get<TaskRow[]>("/api/task-app/tasks", {
        params: { chatThreadId: threadId },
      });
      return res.data;
    },
  });

  const { data: templatesData } = useQuery({
    queryKey: ["chat-templates"],
    queryFn: async () => {
      const res = await api.get<{
        templates: { id: string; label: string; body: string }[];
      }>("/api/chat/templates");
      return res.data;
    },
  });

  const { data: flowsData } = useQuery({
    queryKey: ["chat-flows"],
    queryFn: async () => {
      const res = await api.get<{
        flows: {
          id: string;
          title: string;
          description: string;
          steps: { id: string; label: string; prompt: string }[];
        }[];
      }>("/api/chat/flows");
      return res.data;
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadDetail?.messages, streamText, streaming]);

  const newThread = useMutation({
    mutationFn: async () => {
      if (!projectId) {
        throw new Error("No project");
      }
      const res = await api.post<ChatThreadListItem>("/api/chat/threads", {
        projectId,
        workspaceId,
        consultingMode: mode,
        title: "New chat",
      });
      return res.data;
    },
    onSuccess: (t) => {
      setThreadId(t.id);
      qc.invalidateQueries({ queryKey: ["chat-threads", projectId] });
    },
  });

  const deleteThread = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/chat/threads/${id}`);
    },
    onSuccess: (_, id) => {
      if (threadId === id) {
        setThreadId(null);
      }
      qc.invalidateQueries({ queryKey: ["chat-threads", projectId] });
    },
  });

  const uploadDoc = useMutation({
    mutationFn: async (file: File) => {
      if (!projectId) {
        throw new Error("No project");
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("projectId", projectId);
      if (threadId) {
        fd.append("threadId", threadId);
      }
      const res = await fetch(resolveApiUrl("/api/chat/documents"), {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-docs", projectId] });
    },
  });

  const addTask = useMutation({
    mutationFn: async () => {
      if (!boardId || !taskTitle.trim()) {
        throw new Error("Missing board or title");
      }
      const sourceMessageId = lastCompletedAssistantId ?? lastAssistantMessageIdFromThread;
      await api.post(`/api/task-app/boards/${boardId}/tasks`, {
        title: taskTitle.trim(),
        chatThreadId: threadId ?? undefined,
        sourceMessageId,
      });
    },
    onSuccess: () => {
      setTaskTitle("");
      qc.invalidateQueries({ queryKey: ["chat-thread-tasks", threadId] });
    },
  });

  const sendMessage = useCallback(async () => {
    if (!projectId || !input.trim() || streaming) {
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setStreaming(true);
    setStreamText("");
    setLastCitations([]);
    let activeThreadId = threadId;
    try {
      await streamChatMessage(
        {
          projectId,
          threadId: threadId ?? undefined,
          workspaceId,
          consultingMode: mode,
          message: input.trim(),
          brandCenterContext: getRapidRouterBrandSnippets(12, 6000, workspaceId),
        },
        (ev) => {
          if (ev.type === "meta") {
            activeThreadId = ev.threadId;
            setThreadId(ev.threadId);
            qc.invalidateQueries({ queryKey: ["chat-threads", projectId] });
          }
          if (ev.type === "token") {
            setStreamText((s) => s + ev.text);
          }
          if (ev.type === "done") {
            setLastCitations(ev.citations ?? []);
            setLastCompletedAssistantId(ev.messageId);
          }
          if (ev.type === "error") {
            throw new Error(ev.message);
          }
        },
        abortRef.current.signal,
      );
      setInput("");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        return;
      }
      console.error(e);
    } finally {
      setStreaming(false);
      setStreamText("");
      if (activeThreadId) {
        await qc.invalidateQueries({ queryKey: ["chat-thread", activeThreadId] });
      }
      await qc.invalidateQueries({ queryKey: ["chat-threads", projectId] });
      await qc.invalidateQueries({ queryKey: ["chat-thread-tasks", activeThreadId] });
    }
  }, [projectId, threadId, workspaceId, mode, input, streaming, qc]);

  const stop = () => {
    abortRef.current?.abort();
  };

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) {
      uploadDoc.mutate(f);
    }
  };

  async function exportDeck() {
    if (!threadId) {
      return;
    }
    setExportingDeck(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch(resolveApiUrl("/api/chat/export/pptx"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          threadId,
          messageId: lastCompletedAssistantId ?? lastAssistantMessageIdFromThread,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? res.statusText);
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition");
      const nameMatch = dispo?.match(/filename="([^"]+)"/);
      const filename = nameMatch?.[1] ?? "consulting-deck.pptx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setFeedbackMessage(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportingDeck(false);
    }
  }

  async function runLocalIngest() {
    if (!projectId || !localRelPath.trim()) {
      return;
    }
    setLocalIngestBusy(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch(resolveApiUrl("/api/chat/documents/ingest-local"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          threadId: threadId ?? undefined,
          relativePath: localRelPath.trim(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        scanned?: number;
        indexed?: number;
        skipped?: number;
        capped?: boolean;
        errors?: string[];
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Ingest failed");
      }
      setFeedbackMessage(
        `Indexed ${data.indexed ?? 0} of ${data.scanned ?? 0} files${data.capped ? " (capped)" : ""}.`,
      );
      if (data.errors?.length) {
        setFeedbackMessage((n) => `${n} ${data.errors!.slice(0, 2).join("; ")}`);
      }
      await qc.invalidateQueries({ queryKey: ["chat-docs", projectId] });
    } catch (e) {
      setFeedbackMessage(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      setLocalIngestBusy(false);
    }
  }

  if (bootLoading || !boot) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[100vw] flex-1 flex-col">
      <div className="mb-6 shrink-0">
        <h1 className="text-3xl font-semibold tracking-tight">Consultant Agent</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Team and individual operating context from{" "}
          <Link to="/app/settings" className="font-medium text-primary underline-offset-4 hover:underline">
            Settings → Brands → Agent context
          </Link>{" "}
          is merged into each turn (team rules win on conflict). Structured consulting chat with retrieval, tasks, and
          slide export; the model runs on the server (
          {boot.ai?.backend === "ollama" ?
            <>
              local <span className="font-medium text-foreground">Ollama</span> ({boot.ai.chatModel})
            </>
          : boot.ai?.backend === "groq" ?
            <>
              <span className="font-medium text-foreground">Groq</span> ({boot.ai.chatModel}); document search uses
              OpenAI embeddings when configured
            </>
          : boot.ai?.backend === "openai" ?
            <>
              <span className="font-medium text-foreground">OpenAI</span> ({boot.ai.chatModel})
            </>
          : "configure the API server"}).
        </p>
      </div>

      {/* Desktop: connected three-panel workflow */}
      {isLg ?
        <div className="flex min-h-[calc(100vh-6rem)] flex-1 flex-col">
        <div className="flex min-h-[min(68vh,700px)] flex-1 gap-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <ChatChatsRail
            open={chatsOpen}
            onOpenChange={setChatsOpen}
            label="CHATS"
            widthClass="w-72"
          >
            <p className="text-muted-foreground mb-2 text-[0.65rem] leading-tight">Project & threads</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="project-desktop">Project</Label>
                <select
                  id="project-desktop"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              value={projectId ?? ""}
              onChange={(e) => {
                setProjectId(e.target.value);
                setThreadId(null);
              }}
            >
              {boot.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="workspace-desktop">Brand workspace (tasks)</Label>
            <select
              id="workspace-desktop"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              value={workspaceId ?? ""}
              onChange={(e) => {
                const v = e.target.value || null;
                setWorkspaceId(v);
                if (threadId) {
                  void api.patch(`/api/chat/threads/${threadId}`, { workspaceId: v });
                }
              }}
            >
              {boot.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full gap-2"
            onClick={() => newThread.mutate()}
            disabled={!projectId || newThread.isPending}
          >
            <MessageSquarePlus className="size-4" />
            New chat
          </Button>
          <Separator />
          <div className="max-h-64 space-y-1 overflow-y-auto md:max-h-none">
            {threadsLoading ?
              <p className="text-muted-foreground text-sm">Loading…</p>
            : threads.length === 0 ?
              <p className="text-muted-foreground text-sm">No threads yet.</p>
            : threads.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-start gap-1 rounded-md border border-transparent px-2 py-1.5 text-left text-sm",
                    threadId === t.id ? "bg-muted border-border" : "hover:bg-muted/60",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left font-medium"
                    onClick={() => setThreadId(t.id)}
                  >
                    {t.title}
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Delete thread"
                    onClick={() => deleteThread.mutate(t.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            }
          </div>
            </div>
          </ChatChatsRail>

      {/* Main chat (center column) */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col border-border bg-background">
        <div className="border-border flex shrink-0 flex-row flex-wrap items-center justify-end gap-2 border-b px-4 py-3">
          <Label htmlFor="mode-desktop" className="sr-only">
            Consulting mode
          </Label>
          <select
            id="mode-desktop"
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            value={mode}
            onChange={(e) => {
              const v = e.target.value as ConsultingMode;
              setMode(v);
              if (threadId) {
                void api.patch(`/api/chat/threads/${threadId}`, { consultingMode: v });
              }
            }}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="flex flex-wrap gap-2">
            {templatesData?.templates?.map((t) => (
              <Button
                key={t.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInput(t.body)}
              >
                {t.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              disabled={
                exportingDeck ||
                !threadId ||
                (!lastAssistantMessageIdFromThread && !lastCompletedAssistantId)
              }
              title={
                !threadId ? "Start a thread first"
                : !lastAssistantMessageIdFromThread && !lastCompletedAssistantId ?
                  "Send a message and wait for the assistant reply"
                : "Download PowerPoint from the latest assistant reply"
              }
              onClick={() => void exportDeck()}
            >
              {exportingDeck ?
                <Loader2 className="size-3.5 animate-spin" />
              : <Presentation className="size-3.5" />}
              Export PPTX
            </Button>
          </div>

          {flowsData?.flows && flowsData.flows.length > 0 && (
            <details className="bg-muted/40 rounded-lg border px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium">
                <Layers className="mr-1 inline size-4 align-text-bottom" />
                Guided flows (MECE &amp; more)
              </summary>
              <div className="mt-3 space-y-3">
                {flowsData.flows.map((flow) => (
                  <div key={flow.id}>
                    <p className="text-foreground font-medium">{flow.title}</p>
                    <p className="text-muted-foreground text-xs">{flow.description}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {flow.steps.map((step) => (
                        <Button
                          key={step.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setInput((prev) => (prev ? `${prev}\n\n` : "") + step.prompt)}
                        >
                          {step.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="bg-muted/30 max-h-[min(480px,55vh)] min-h-[200px] space-y-3 overflow-y-auto rounded-lg border p-3">
            {!threadId && !streaming && (
              <p className="text-muted-foreground text-sm">
                Select a thread or send a message to start. Documents you upload to this project are
                retrieved automatically for citations.
              </p>
            )}
            {threadLoading && threadId ?
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            : null}
            {threadDetail?.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border",
                  )}
                >
                  {m.content}
                  {m.citations && m.citations.length > 0 && m.role === "assistant" && (
                    <div className="border-border mt-2 border-t pt-2 text-xs opacity-90">
                      <span className="font-medium">Sources:</span>{" "}
                      {m.citations.map((c) => (
                        <span key={c.chunkId} className="mr-2">
                          [{c.ref}] {c.filename}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {streaming && streamText && (
              <div className="flex justify-start">
                <div className="bg-card max-w-[85%] rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap">
                  {streamText}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[88px] flex-1 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Ask for analysis, memos, roadmaps… (Shift+Enter for newline)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              disabled={streaming}
            />
            <div className="flex shrink-0 flex-col gap-2">
              <Button
                type="button"
                onClick={() => void sendMessage()}
                disabled={streaming || !input.trim() || !projectId}
                className="gap-2"
              >
                {streaming ?
                  <Loader2 className="size-4 animate-spin" />
                : <Send className="size-4" />}
                Send
              </Button>
              {streaming && (
                <Button type="button" variant="outline" onClick={stop} className="gap-2">
                  <StopCircle className="size-4" />
                  Stop
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

          <ChatContextRail
            open={contextOpen}
            onOpenChange={setContextOpen}
            label="CONTEXT"
            widthClass="w-80"
            headerLeft={<PanelRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
          >
            <p className="text-muted-foreground mb-2 text-[0.65rem] leading-tight">Documents, citations, tasks</p>
            <div className="space-y-4">
          {feedbackMessage && (
            <p className="bg-muted text-foreground rounded-md border px-2 py-1.5 text-xs">{feedbackMessage}</p>
          )}
          <div>
            <Label className="mb-2 block">Upload document</Label>
            <input ref={fileRef} type="file" className="hidden" onChange={onFilePick} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={uploadDoc.isPending || !projectId}
            >
              {uploadDoc.isPending ?
                <Loader2 className="size-4 animate-spin" />
              : <FileText className="size-4" />}
              Choose file
            </Button>
            <p className="text-muted-foreground mt-1 text-xs">PDF, DOCX, TXT, MD — indexed for RAG.</p>
          </div>

          <Separator />

          <div>
            <h4 className="mb-2 text-sm font-medium">Project documents</h4>
            <ul className="max-h-36 space-y-1 overflow-y-auto text-sm">
              {documents.length === 0 ?
                <li className="text-muted-foreground">None yet.</li>
              : documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 truncate">
                    <span className="truncate">{d.filename}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">{d._count.chunks} chunks</span>
                  </li>
                ))
              }
            </ul>
          </div>

          {lastCitations.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="mb-2 text-sm font-medium">Last retrieval</h4>
                <ul className="space-y-1 text-xs">
                  {lastCitations.map((c) => (
                    <li key={c.chunkId}>
                      [{c.ref}] {c.filename}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <Separator />

          <div>
            <h4 className="mb-2 text-sm font-medium">Tasks from this chat</h4>
            <ul className="mb-2 max-h-32 space-y-1 overflow-y-auto text-sm">
              {threadTasks.length === 0 ?
                <li className="text-muted-foreground">No linked tasks.</li>
              : threadTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <span className={cn(t.completed && "line-through opacity-60")}>{t.title}</span>
                  </li>
                ))
              }
            </ul>
            <div className="flex gap-2">
              <Input
                placeholder="Add task to backlog…"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTask.mutate();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                disabled={!taskTitle.trim() || !boardId || addTask.isPending}
                onClick={() => addTask.mutate()}
              >
                Add
              </Button>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="mb-1 text-sm font-medium">Local folder (server)</h4>
            <p className="text-muted-foreground mb-2 text-xs">
              Requires <code className="text-xs">ALLOW_LOCAL_PATH_INGEST=true</code> and{" "}
              <code className="text-xs">LOCAL_INGEST_ROOT</code> on the API host. Path is relative to
              that root.
            </p>
            <Input
              className="mb-2"
              placeholder="e.g. research/notes"
              value={localRelPath}
              onChange={(e) => setLocalRelPath(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={localIngestBusy || !projectId || !localRelPath.trim()}
              onClick={() => void runLocalIngest()}
            >
              {localIngestBusy ?
                <Loader2 className="size-4 animate-spin" />
              : "Scan & index folder"}
            </Button>
          </div>
            </div>
          </ChatContextRail>
        </div>
      </div>
      : null}

      {/* Mobile / tablet: stacked cards */}
      {!isLg ?
        <div className="flex min-h-[calc(100vh-6rem)] flex-1 flex-col gap-4">
        <Card className="shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Chats</CardTitle>
            <CardDescription>Project & threads</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-mobile">Project</Label>
              <select
                id="project-mobile"
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                value={projectId ?? ""}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setThreadId(null);
                }}
              >
                {boot.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="workspace-mobile">Brand workspace (tasks)</Label>
              <select
                id="workspace-mobile"
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                value={workspaceId ?? ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  setWorkspaceId(v);
                  if (threadId) {
                    void api.patch(`/api/chat/threads/${threadId}`, { workspaceId: v });
                  }
                }}
              >
                {boot.workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2"
              onClick={() => newThread.mutate()}
              disabled={!projectId || newThread.isPending}
            >
              <MessageSquarePlus className="size-4" />
              New chat
            </Button>
            <Separator />
            <div className="max-h-64 space-y-1 overflow-y-auto md:max-h-none">
              {threadsLoading ?
                <p className="text-muted-foreground text-sm">Loading…</p>
              : threads.length === 0 ?
                <p className="text-muted-foreground text-sm">No threads yet.</p>
              : threads.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-start gap-1 rounded-md border border-transparent px-2 py-1.5 text-left text-sm",
                      threadId === t.id ? "bg-muted border-border" : "hover:bg-muted/60",
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left font-medium"
                      onClick={() => setThreadId(t.id)}
                    >
                      {t.title}
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Delete thread"
                      onClick={() => deleteThread.mutate(t.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              }
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 flex-1">
          <CardHeader className="flex flex-row flex-wrap items-center justify-end gap-2 pb-3">
            <Label htmlFor="mode-mobile" className="sr-only">
              Consulting mode
            </Label>
            <select
              id="mode-mobile"
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              value={mode}
              onChange={(e) => {
                const v = e.target.value as ConsultingMode;
                setMode(v);
                if (threadId) {
                  void api.patch(`/api/chat/threads/${threadId}`, { consultingMode: v });
                }
              }}
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {templatesData?.templates?.map((t) => (
                <Button
                  key={t.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInput(t.body)}
                >
                  {t.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                disabled={
                  exportingDeck ||
                  !threadId ||
                  (!lastAssistantMessageIdFromThread && !lastCompletedAssistantId)
                }
                title={
                  !threadId ? "Start a thread first"
                  : !lastAssistantMessageIdFromThread && !lastCompletedAssistantId ?
                    "Send a message and wait for the assistant reply"
                  : "Download PowerPoint from the latest assistant reply"
                }
                onClick={() => void exportDeck()}
              >
                {exportingDeck ?
                  <Loader2 className="size-3.5 animate-spin" />
                : <Presentation className="size-3.5" />}
                Export PPTX
              </Button>
            </div>

            {flowsData?.flows && flowsData.flows.length > 0 && (
              <details className="bg-muted/40 rounded-lg border px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium">
                  <Layers className="mr-1 inline size-4 align-text-bottom" />
                  Guided flows (MECE &amp; more)
                </summary>
                <div className="mt-3 space-y-3">
                  {flowsData.flows.map((flow) => (
                    <div key={flow.id}>
                      <p className="text-foreground font-medium">{flow.title}</p>
                      <p className="text-muted-foreground text-xs">{flow.description}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {flow.steps.map((step) => (
                          <Button
                            key={step.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setInput((prev) => (prev ? `${prev}\n\n` : "") + step.prompt)}
                          >
                            {step.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="bg-muted/30 max-h-[min(480px,55vh)] min-h-[200px] space-y-3 overflow-y-auto rounded-lg border p-3">
              {!threadId && !streaming && (
                <p className="text-muted-foreground text-sm">
                  Select a thread or send a message to start. Documents you upload to this project are
                  retrieved automatically for citations.
                </p>
              )}
              {threadLoading && threadId ?
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              : null}
              {threadDetail?.messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border",
                    )}
                  >
                    {m.content}
                    {m.citations && m.citations.length > 0 && m.role === "assistant" && (
                      <div className="border-border mt-2 border-t pt-2 text-xs opacity-90">
                        <span className="font-medium">Sources:</span>{" "}
                        {m.citations.map((c) => (
                          <span key={c.chunkId} className="mr-2">
                            [{c.ref}] {c.filename}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {streaming && streamText && (
                <div className="flex justify-start">
                  <div className="bg-card max-w-[85%] rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap">
                    {streamText}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[88px] flex-1 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Ask for analysis, memos, roadmaps… (Shift+Enter for newline)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                disabled={streaming}
              />
              <div className="flex shrink-0 flex-col gap-2">
                <Button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={streaming || !input.trim() || !projectId}
                  className="gap-2"
                >
                  {streaming ?
                    <Loader2 className="size-4 animate-spin" />
                  : <Send className="size-4" />}
                  Send
                </Button>
                {streaming && (
                  <Button type="button" variant="outline" onClick={stop} className="gap-2">
                    <StopCircle className="size-4" />
                    Stop
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PanelRight className="size-4" />
              Context
            </CardTitle>
            <CardDescription>Documents, citations, tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {feedbackMessage && (
              <p className="bg-muted text-foreground rounded-md border px-2 py-1.5 text-xs">{feedbackMessage}</p>
            )}
            <div>
              <Label className="mb-2 block">Upload document</Label>
              <input ref={fileRef} type="file" className="hidden" onChange={onFilePick} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileRef.current?.click()}
                disabled={uploadDoc.isPending || !projectId}
              >
                {uploadDoc.isPending ?
                  <Loader2 className="size-4 animate-spin" />
                : <FileText className="size-4" />}
                Choose file
              </Button>
              <p className="text-muted-foreground mt-1 text-xs">PDF, DOCX, TXT, MD — indexed for RAG.</p>
            </div>

            <Separator />

            <div>
              <h4 className="mb-2 text-sm font-medium">Project documents</h4>
              <ul className="max-h-36 space-y-1 overflow-y-auto text-sm">
                {documents.length === 0 ?
                  <li className="text-muted-foreground">None yet.</li>
                : documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 truncate">
                      <span className="truncate">{d.filename}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">{d._count.chunks} chunks</span>
                    </li>
                  ))
                }
              </ul>
            </div>

            {lastCitations.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="mb-2 text-sm font-medium">Last retrieval</h4>
                  <ul className="space-y-1 text-xs">
                    {lastCitations.map((c) => (
                      <li key={c.chunkId}>
                        [{c.ref}] {c.filename}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <Separator />

            <div>
              <h4 className="mb-2 text-sm font-medium">Tasks from this chat</h4>
              <ul className="mb-2 max-h-32 space-y-1 overflow-y-auto text-sm">
                {threadTasks.length === 0 ?
                  <li className="text-muted-foreground">No linked tasks.</li>
                : threadTasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <span className={cn(t.completed && "line-through opacity-60")}>{t.title}</span>
                    </li>
                  ))
                }
              </ul>
              <div className="flex gap-2">
                <Input
                  placeholder="Add task to backlog…"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTask.mutate();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!taskTitle.trim() || !boardId || addTask.isPending}
                  onClick={() => addTask.mutate()}
                >
                  Add
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="mb-1 text-sm font-medium">Local folder (server)</h4>
              <p className="text-muted-foreground mb-2 text-xs">
                Requires <code className="text-xs">ALLOW_LOCAL_PATH_INGEST=true</code> and{" "}
                <code className="text-xs">LOCAL_INGEST_ROOT</code> on the API host. Path is relative to
                that root.
              </p>
              <Input
                className="mb-2"
                placeholder="e.g. research/notes"
                value={localRelPath}
                onChange={(e) => setLocalRelPath(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={localIngestBusy || !projectId || !localRelPath.trim()}
                onClick={() => void runLocalIngest()}
              >
                {localIngestBusy ?
                  <Loader2 className="size-4 animate-spin" />
                : "Scan & index folder"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      : null}
    </div>
  );
}
