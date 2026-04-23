import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  FilePenLine,
  Goal,
  Inbox,
  LayoutGrid,
  Lightbulb,
  Loader2,
  Mail,
  Send,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RapidRouterIcon } from "@/components/shared/RapidRouterIcon";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  appendIdeaToBrainstorm,
  removeBrainstormIdeaNode,
} from "@/features/rapidRouter/appendBrainstormIdea";
import { fetchBrainstormSessionsList } from "@/features/brainstorm/api";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { useMailroomRouting } from "@/context/MailroomRoutingContext";
import {
  postMailroomDecomposition,
  postMailroomRouteFromActions,
  type MailroomPlanChunk,
  type MailroomPlanPayload,
} from "@/features/agents/api";
import { RedTeamPanel } from "@/features/agents/RedTeamPanel";
import {
  createBoardTask,
  createRoutingHold,
  deleteRoutingHold,
  fetchBoard,
  fetchRoutingHolds,
  patchRoutingHold,
  patchTask,
} from "@/features/taskflow/api";
import { createNote, deleteNote, fetchNotesBootstrap } from "@/features/notes/api";
import { extractPreviewFromDoc } from "@/features/notes/extractPreview";
import { plainTextToTipTapDoc } from "@/features/notes/noteUtils";
import {
  appendRapidRouterBrandCapture,
  removeRapidRouterBrandEntry,
} from "@/features/brand/brandKitContext";
import {
  MAIL_ADD_BOARD,
  MAIL_ADD_FOLDER,
  MAIL_ADD_SESSION,
  buildChunkRoutesFromPlan,
  type MailPlanChunkRoute,
} from "@/features/rapidRouter/mailPlanChunkRouting";
import {
  actionRowsFromDecomposition,
  selectedActionItemsForRoute,
  type MailClerkActionRow,
} from "@/features/rapidRouter/mailClerkActionRows";
import {
  loadRapidRouterDraft,
  type RapidRouterDraftV1,
  type RapidRouterManualDestination,
  saveRapidRouterDraft,
} from "@/features/rapidRouter/rapidRouterDraftStorage";
import {
  clearRoutedGlow,
  markRoutedGlow,
} from "@/features/rapidRouter/routedHighlightStore";
import { useRoutingToast } from "@/context/RoutingToastContext";
import { cn } from "@/lib/utils";

/* Rapid Router syncs workspace, bootstrap defaults, and local draft via effects. */
/* eslint-disable react-hooks/set-state-in-effect */

function stickiesStorageKey(workspaceId: string): string {
  return `atlas.rapidRouter.stickies.ws.${workspaceId}`;
}

type Destination = RapidRouterManualDestination;

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

function loadStickiesForWorkspace(workspaceId: string): RapidSticky[] {
  try {
    const raw = localStorage.getItem(stickiesStorageKey(workspaceId));
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

function persistStickies(stickies: RapidSticky[], workspaceId: string) {
  try {
    localStorage.setItem(stickiesStorageKey(workspaceId), JSON.stringify(stickies));
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

function chunkToHoldBody(c: MailroomPlanChunk, index: number): string {
  const parts = [
    c.summary.trim(),
    c.targetHint ? `Target: ${c.targetHint}` : "",
    c.rationale?.trim(),
  ].filter(Boolean);
  return parts.join("\n\n").trim() || `Chunk ${index + 1}`;
}

function chunkHoldMeta(c: MailroomPlanChunk, index: number) {
  return {
    mailClerkChunk: {
      index,
      suggestedDestination: c.suggestedDestination,
      targetHint: c.targetHint,
      confidence: c.confidence,
    },
  };
}

/** Plain text for a draft note so the user can revise before final routing. */
function reviseNoteBodyFromChunk(c: MailroomPlanChunk, index: number): string {
  const core = chunkToHoldBody(c, index);
  return [
    "[Mail Clerk — revise before routing]",
    "",
    `Suggested destination: ${c.suggestedDestination}`,
    ...(c.targetHint ? [`Target hint: ${c.targetHint}`] : []),
    `Plan confidence: ${Math.round(c.confidence * 100)}%`,
    "",
    "---",
    "",
    core,
  ].join("\n");
}

export function RapidRouterPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pushRoutingToast = useRoutingToast();
  const { openMailroom } = useMailroomRouting();
  const { activeWorkspace, activeWorkspaceId, workspaces, isLoading: workspacesLoading } =
    useActiveWorkspace();
  const [text, setText] = useState("");
  const [destination, setDestination] = useState<Destination>("boards");
  const [captureOk, setCaptureOk] = useState<string | null>(null);
  const [mailInstruction, setMailInstruction] = useState("");
  const [mailPlan, setMailPlan] = useState<MailroomPlanPayload | null>(null);
  const [mailPlanError, setMailPlanError] = useState<string | null>(null);
  const [planChunkError, setPlanChunkError] = useState<string | null>(null);
  const [chunkRoutes, setChunkRoutes] = useState<MailPlanChunkRoute[]>([]);
  const [mailDecomposeSummary, setMailDecomposeSummary] = useState<string | null>(null);
  const [mailActionRows, setMailActionRows] = useState<MailClerkActionRow[]>([]);
  const [stickies, setStickies] = useState<RapidSticky[]>(() => [{ id: crypto.randomUUID(), body: "" }]);
  const [mailClerkRoutingOpen, setMailClerkRoutingOpen] = useState(false);
  const [manualRoutingPanelOpen, setManualRoutingPanelOpen] = useState(false);
  const [holdingPenOpen, setHoldingPenOpen] = useState(false);

  const redTeamContext = useMemo(() => {
    const parts = [text.trim(), ...stickies.map((s) => s.body.trim())].filter(Boolean);
    return parts.join("\n\n").slice(0, 8000);
  }, [text, stickies]);

  const [boardsBoardId, setBoardsBoardId] = useState<string | null>(null);
  const [boardsListId, setBoardsListId] = useState<string | null>(null);
  const [notesFolderId, setNotesFolderId] = useState<string | null>(null);
  const [brainstormSessionId, setBrainstormSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setStickies(loadStickiesForWorkspace(activeWorkspaceId));
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    persistStickies(stickies, activeWorkspaceId);
  }, [stickies, activeWorkspaceId]);

  /** Rehydrate Rapid Router draft when the active brand workspace changes (device-local). */
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const d = loadRapidRouterDraft(activeWorkspaceId);
    if (d) {
      setText(d.captureText);
      setMailInstruction(d.mailInstruction);
      setMailDecomposeSummary(d.mailDecomposeSummary ?? null);
      setMailActionRows(Array.isArray(d.mailActionRows) ? d.mailActionRows : []);
      setMailPlan(d.mailPlan);
      setChunkRoutes(Array.isArray(d.chunkRoutes) ? d.chunkRoutes : []);
      setDestination(d.destination);
      setNotesFolderId(d.notesFolderId);
      setBoardsBoardId(d.boardsBoardId);
      setBoardsListId(d.boardsListId);
      setBrainstormSessionId(d.brainstormSessionId);
      setMailClerkRoutingOpen(d.mailClerkRoutingOpen);
      setManualRoutingPanelOpen(d.manualRoutingPanelOpen);
      setHoldingPenOpen(d.holdingPenOpen);
    } else {
      setText("");
      setMailInstruction("");
      setMailDecomposeSummary(null);
      setMailActionRows([]);
      setMailPlan(null);
      setChunkRoutes([]);
      setDestination("boards");
      setNotesFolderId(null);
      setBoardsBoardId(null);
      setBoardsListId(null);
      setBrainstormSessionId(null);
      setMailClerkRoutingOpen(false);
      setManualRoutingPanelOpen(false);
      setHoldingPenOpen(false);
    }
    setMailPlanError(null);
    setPlanChunkError(null);
  }, [activeWorkspaceId]);

  const draftSnapshot = useMemo((): RapidRouterDraftV1 | null => {
    if (!activeWorkspaceId) return null;
    return {
      v: 1,
      captureText: text,
      mailInstruction,
      mailDecomposeSummary,
      mailActionRows: mailActionRows.length ? mailActionRows : null,
      mailPlan,
      chunkRoutes,
      destination,
      notesFolderId,
      boardsBoardId,
      boardsListId,
      brainstormSessionId,
      mailClerkRoutingOpen,
      manualRoutingPanelOpen,
      holdingPenOpen,
    };
  }, [
    activeWorkspaceId,
    text,
    mailInstruction,
    mailDecomposeSummary,
    mailActionRows,
    mailPlan,
    chunkRoutes,
    destination,
    notesFolderId,
    boardsBoardId,
    boardsListId,
    brainstormSessionId,
    mailClerkRoutingOpen,
    manualRoutingPanelOpen,
    holdingPenOpen,
  ]);

  useEffect(() => {
    if (!activeWorkspaceId || !draftSnapshot) return;
    const t = window.setTimeout(() => {
      saveRapidRouterDraft(activeWorkspaceId, draftSnapshot);
    }, 400);
    return () => window.clearTimeout(t);
  }, [activeWorkspaceId, draftSnapshot]);

  const notesBootstrapQuery = useQuery({
    queryKey: ["notes-app", "bootstrap", activeWorkspaceId ?? "default"],
    queryFn: () => fetchNotesBootstrap(activeWorkspaceId ?? undefined),
    enabled: !workspacesLoading,
  });

  const brainstormSessionsQuery = useQuery({
    queryKey: ["brainstorm", "sessions-list", activeWorkspaceId ?? ""],
    queryFn: () => fetchBrainstormSessionsList(activeWorkspaceId!),
    enabled: !workspacesLoading && Boolean(activeWorkspaceId),
  });

  const defaultBoardId = activeWorkspace?.projectSpaces?.[0]?.boards?.[0]?.id ?? null;

  useEffect(() => {
    if (!defaultBoardId) return;
    setBoardsBoardId((prev) => prev ?? defaultBoardId);
  }, [activeWorkspaceId, defaultBoardId]);

  useEffect(() => {
    const def = notesBootstrapQuery.data?.defaultFolderId;
    if (!def) return;
    setNotesFolderId((prev) => prev ?? def);
  }, [activeWorkspaceId, notesBootstrapQuery.data?.defaultFolderId]);

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
    return workspaces.flatMap((w) =>
      w.projectSpaces.flatMap((ps) =>
        ps.boards.map((b) => ({
        id: b.id,
        name: b.name,
          workspaceName: `${w.name} — ${ps.name}`,
      })),
      ),
    );
  }, [workspaces]);

  const notesReady = notesBootstrapQuery.data?.workspace?.id && notesBootstrapQuery.data.defaultFolderId;
  const notesFolders = notesBootstrapQuery.data?.folders ?? [];
  const brainstormSessions = brainstormSessionsQuery.data?.sessions ?? [];

  const mailChunkBoardQueries = useQueries({
    queries: (mailPlan?.chunks ?? []).map((_, i) => {
      const r = chunkRoutes[i];
      const bid = r?.category === "boards" ? r.boardsBoardId : null;
      return {
        queryKey: ["board", bid, "mail-clerk-chunk", i],
        queryFn: () => fetchBoard(bid!),
        enabled: Boolean(mailPlan) && Boolean(bid) && r?.category === "boards",
      };
    }),
  });

  useEffect(() => {
    if (!mailPlan?.chunks.length || chunkRoutes.length !== mailPlan.chunks.length) return;
    setChunkRoutes((prev) => {
      let changed = false;
      const next = prev.map((route, i) => {
        if (route.category !== "boards" || !route.boardsBoardId) return route;
        const lists = mailChunkBoardQueries[i]?.data?.lists;
        if (!lists?.length) return route;
        const listValid = route.boardsListId && lists.some((l) => l.id === route.boardsListId);
        if (listValid) return route;
        const backlog = lists.find((l) => l.key === "backlog")?.id ?? lists[0].id;
        if (!backlog || route.boardsListId === backlog) return route;
        changed = true;
        return { ...route, boardsListId: backlog };
      });
      return changed ? next : prev;
    });
  }, [mailPlan?.chunks.length, chunkRoutes.length, mailChunkBoardQueries]);

  /** Repair draft if stored chunk routes no longer match the mail plan. */
  useEffect(() => {
    if (!mailPlan?.chunks.length) return;
    if (chunkRoutes.length === mailPlan.chunks.length) return;
    const defaultNotesFolderId = notesBootstrapQuery.data?.defaultFolderId ?? null;
    const firstBoardId =
      activeWorkspace?.projectSpaces?.[0]?.boards?.[0]?.id ?? flatBoards[0]?.id ?? null;
    const firstSessionId = brainstormSessions[0]?.id ?? null;
    setChunkRoutes(
      buildChunkRoutesFromPlan(mailPlan.chunks, {
        defaultNotesFolderId,
        validFolderIds: new Set(notesFolders.map((f) => f.id)),
        firstBoardId,
        validBoardIds: new Set(flatBoards.map((b) => b.id)),
        firstBrainstormSessionId: firstSessionId,
        validSessionIds: new Set(brainstormSessions.map((s) => s.id)),
      }),
    );
  }, [
    mailPlan,
    chunkRoutes.length,
    notesBootstrapQuery.data?.defaultFolderId,
    notesFolders,
    flatBoards,
    activeWorkspace?.projectSpaces,
    brainstormSessions,
  ]);

  const mailDecomposeMutation = useMutation({
    mutationFn: async () => {
      if (!activeWorkspaceId) throw new Error("no-workspace");
      const capture = redTeamContext.trim();
      if (!capture) throw new Error("empty-capture");
      setMailPlanError(null);
      const res = await postMailroomDecomposition({
        workspaceId: activeWorkspaceId,
        capture,
        instruction: mailInstruction.trim() || undefined,
      });
      if (!res.decomposition?.actionItems?.length) throw new Error("no-decomposition");
      return res.decomposition;
    },
    onSuccess: (decomposition) => {
      setMailPlanError(null);
      setMailPlan(null);
      setChunkRoutes([]);
      setPlanChunkError(null);
      setMailDecomposeSummary(decomposition.executiveSummary);
      setMailActionRows(actionRowsFromDecomposition(decomposition.actionItems));
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "empty-capture") {
        setMailPlanError("Add text in Capture or sticky notes first.");
      } else if (msg === "no-decomposition") {
        setMailPlanError("Mail Clerk did not return any actions — try again or shorten the capture.");
      } else {
        setMailPlanError("Could not scan the capture. Check the API and try again.");
      }
    },
  });

  const mailRouteMutation = useMutation({
    mutationFn: async () => {
      if (!activeWorkspaceId) throw new Error("no-workspace");
      const actionItems = selectedActionItemsForRoute(mailActionRows);
      if (!actionItems.length) throw new Error("no-selection");
      setMailPlanError(null);
      const res = await postMailroomRouteFromActions({
        workspaceId: activeWorkspaceId,
        actionItems,
        instruction: mailInstruction.trim() || undefined,
        originalCapture: redTeamContext.trim(),
      });
      if (!res.plan?.chunks?.length) throw new Error("no-plan");
      return res.plan;
    },
    onSuccess: (plan) => {
      setMailPlan(plan);
      setPlanChunkError(null);
      const defaultNotesFolderId = notesBootstrapQuery.data?.defaultFolderId ?? null;
      const firstBoardId =
        activeWorkspace?.projectSpaces?.[0]?.boards?.[0]?.id ?? flatBoards[0]?.id ?? null;
      const firstSessionId = brainstormSessions[0]?.id ?? null;
      setChunkRoutes(
        buildChunkRoutesFromPlan(plan.chunks, {
          defaultNotesFolderId,
          validFolderIds: new Set(notesFolders.map((f) => f.id)),
          firstBoardId,
          validBoardIds: new Set(flatBoards.map((b) => b.id)),
          firstBrainstormSessionId: firstSessionId,
          validSessionIds: new Set(brainstormSessions.map((s) => s.id)),
        }),
      );
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "no-selection") {
        setMailPlanError("Select at least one action with a title or details, then assign destinations.");
      } else {
        setMailPlanError("Could not assign destinations. Check the API and try again.");
      }
    },
  });

  const updateChunkRouteField = useCallback(
    (index: number, patch: Partial<MailPlanChunkRoute>) => {
      setChunkRoutes((prev) => {
        const cur = prev[index];
        if (!cur) return prev;
        const next = [...prev];
        if (patch.category && patch.category !== cur.category) {
          const d = notesBootstrapQuery.data?.defaultFolderId ?? null;
          const fb = flatBoards[0]?.id ?? activeWorkspace?.projectSpaces?.[0]?.boards?.[0]?.id ?? null;
          const fs = brainstormSessions[0]?.id ?? null;
          if (patch.category === "notes") {
            next[index] = {
              category: "notes",
              notesFolderId: d,
              boardsBoardId: null,
              boardsListId: null,
              brainstormSessionId: null,
            };
          } else if (patch.category === "boards") {
            next[index] = {
              category: "boards",
              notesFolderId: null,
              boardsBoardId: fb,
              boardsListId: null,
              brainstormSessionId: null,
            };
          } else if (patch.category === "brainstorm") {
            next[index] = {
              category: "brainstorm",
              notesFolderId: null,
              boardsBoardId: null,
              boardsListId: null,
              brainstormSessionId: fs,
            };
          } else if (patch.category === "brand_center") {
            next[index] = {
              category: "brand_center",
              notesFolderId: null,
              boardsBoardId: null,
              boardsListId: null,
              brainstormSessionId: null,
            };
          } else {
            next[index] = {
              category: patch.category,
              notesFolderId: null,
              boardsBoardId: null,
              boardsListId: null,
              brainstormSessionId: null,
            };
          }
        } else {
          next[index] = { ...cur, ...patch };
        }
        return next;
      });
    },
    [notesBootstrapQuery.data?.defaultFolderId, flatBoards, activeWorkspace, brainstormSessions],
  );

  const routeChunkMutation = useMutation({
    mutationFn: async ({
      c,
      i,
      route,
    }: {
      c: MailroomPlanChunk;
      i: number;
      route: MailPlanChunkRoute;
    }) => {
      if (!activeWorkspaceId) throw new Error("no-workspace");
      const raw = chunkToHoldBody(c, i);
      const d = route.category;

      if (d === "brand_center") {
        const entry = appendRapidRouterBrandCapture(raw, activeWorkspaceId);
        if (!entry) throw new Error("brand-storage");
        return {
          where: "brandCenter" as const,
          brandEntryId: entry.id,
          workspaceId: activeWorkspaceId,
          vars: { c, i, route } as const,
        };
      }

      if (d === "notes") {
        const ws = notesBootstrapQuery.data?.workspace.id;
        const folderId = route.notesFolderId ?? notesBootstrapQuery.data?.defaultFolderId;
        if (!ws || !folderId) throw new Error("no-notes");
        const doc = plainTextToTipTapDoc(raw);
        const preview = extractPreviewFromDoc(doc);
        const titleLine = raw.split("\n")[0]?.trim() || `Chunk ${i + 1}`;
        const note = await createNote({
          workspaceId: ws,
          folderId,
          title: titleLine.slice(0, 500),
          contentJson: doc,
          previewText: preview || null,
          routingSource: "mail_clerk_plan",
        });
        return {
          where: "notes" as const,
          noteId: note.id,
          notesWorkspaceId: ws,
          vars: { c, i, route } as const,
        };
      }

      if (d === "brainstorm") {
        const sid = route.brainstormSessionId;
        if (!sid) throw new Error("no-session");
        const { sessionId, nodeId } = await appendIdeaToBrainstorm(raw, activeWorkspaceId, sid);
        return {
          where: "brainstorm" as const,
          sessionId,
          nodeId,
          workspaceId: activeWorkspaceId,
          vars: { c, i, route } as const,
        };
      }

      if (d === "boards") {
        if (!route.boardsBoardId || !route.boardsListId) throw new Error("no-board-target");
        const { title, description } = splitTaskTitleDescription(raw);
        const task = await createBoardTask(route.boardsBoardId, {
          listId: route.boardsListId,
          title,
          ...(description ? { description } : {}),
          routingSource: "mail_clerk_plan",
        });
        return {
          where: "boards" as const,
          taskId: task.id,
          workspaceId: activeWorkspaceId,
          vars: { c, i, route } as const,
        };
      }

      if (d === "hold" || d === "other") {
        const hold = await createRoutingHold(activeWorkspaceId, {
          body: raw,
          source: "mail_clerk_plan",
          meta: { ...chunkHoldMeta(c, i), resolvedRoute: route },
        });
        return {
          where: "hold" as const,
          holdId: hold.id,
          workspaceId: activeWorkspaceId,
          vars: { c, i, route } as const,
        };
      }

      throw new Error("unknown-destination");
    },
    onSuccess: (result) => {
      setPlanChunkError(null);
      const { vars } = result;
      const { i } = vars;
      setMailPlan((prev) => {
        if (!prev) return null;
        const chunks = prev.chunks.filter((_, idx) => idx !== i);
        return chunks.length ? { ...prev, chunks } : null;
      });
      setChunkRoutes((prev) => prev.filter((_, idx) => idx !== i));

      const restoreMailChunk = () => {
        setMailPlan((prev) => {
          const { c, i: idx } = vars;
          if (!prev) {
            return { executiveSummary: "Restored plan", chunks: [c] };
          }
          const chunks = [...prev.chunks];
          chunks.splice(idx, 0, c);
          return { ...prev, chunks };
        });
        setChunkRoutes((prev) => {
          const { route, i: idx } = vars;
          const next = [...prev];
          next.splice(idx, 0, route);
          return next;
        });
      };

      const label =
        result.where === "brandCenter"
          ? "Brand Center (this device)"
          : result.where === "notes"
            ? "Notebooks"
            : result.where === "brainstorm"
              ? "Brainstorm"
              : result.where === "boards"
                ? "Project boards"
                : "Holding pen";

      queryClient.invalidateQueries({ queryKey: ["board"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      queryClient.invalidateQueries({ queryKey: ["notes-app"] });
      queryClient.invalidateQueries({ queryKey: ["brainstorm"] });
      if (activeWorkspaceId) {
        void queryClient.invalidateQueries({ queryKey: ["routing-holds", activeWorkspaceId] });
      }

      if (result.where === "notes") {
        markRoutedGlow({
          kind: "note",
          id: result.noteId,
          workspaceId: result.notesWorkspaceId,
        });
        pushRoutingToast({
          message: `Mail Clerk part sent to ${label}.`,
          undo: async () => {
            await deleteNote(result.noteId);
            clearRoutedGlow("note", result.noteId, result.notesWorkspaceId);
            restoreMailChunk();
            void queryClient.invalidateQueries({ queryKey: ["notes-app"] });
          },
        });
        return;
      }

      if (result.where === "boards") {
        markRoutedGlow({
          kind: "task",
          id: result.taskId,
          workspaceId: result.workspaceId,
        });
        pushRoutingToast({
          message: `Mail Clerk part added to ${label}.`,
          undo: async () => {
            await patchTask(result.taskId, { archived: true });
            clearRoutedGlow("task", result.taskId, result.workspaceId);
            restoreMailChunk();
            void queryClient.invalidateQueries({ queryKey: ["board"] });
            void queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
          },
        });
        return;
      }

      if (result.where === "brainstorm") {
        markRoutedGlow({
          kind: "brainstorm",
          id: result.nodeId,
          workspaceId: result.workspaceId,
          sessionId: result.sessionId,
        });
        pushRoutingToast({
          message: `Mail Clerk part added to ${label}.`,
          undo: async () => {
            await removeBrainstormIdeaNode(result.workspaceId, result.sessionId, result.nodeId);
            clearRoutedGlow("brainstorm", result.nodeId, result.workspaceId, result.sessionId);
            restoreMailChunk();
            void queryClient.invalidateQueries({ queryKey: ["brainstorm"] });
          },
        });
        return;
      }

      if (result.where === "brandCenter") {
        pushRoutingToast({
          message: `Mail Clerk part saved to ${label}.`,
          undo: async () => {
            removeRapidRouterBrandEntry(result.brandEntryId, result.workspaceId);
            restoreMailChunk();
          },
        });
        return;
      }

      pushRoutingToast({
        message: `Mail Clerk part queued in ${label}.`,
        undo: async () => {
          await deleteRoutingHold(result.workspaceId, result.holdId);
          restoreMailChunk();
          if (activeWorkspaceId) {
            void queryClient.invalidateQueries({ queryKey: ["routing-holds", activeWorkspaceId] });
          }
        },
      });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "no-notes") {
        setPlanChunkError(
          "Routing to notes needs notebooks loaded — open Notebooks once or choose a folder under Manual routing.",
        );
      } else if (msg === "no-board-target") {
        setPlanChunkError("Pick a project board and list for this part, then try again.");
      } else if (msg === "no-session") {
        setPlanChunkError("Pick a brainstorm session for this part, then try again.");
      } else if (msg === "brand-storage") {
        setPlanChunkError("Could not save to Brand Center on this device.");
      } else {
        setPlanChunkError("Could not route this chunk. Try again or use Manual routing.");
      }
      window.setTimeout(() => setPlanChunkError(null), 7000);
    },
  });

  const reviseChunkNoteMutation = useMutation({
    mutationFn: async ({
      c,
      i,
      folderId: folderIdArg,
    }: {
      c: MailroomPlanChunk;
      i: number;
      folderId: string;
    }) => {
      const ws = notesBootstrapQuery.data?.workspace.id;
      const folderId = folderIdArg || notesBootstrapQuery.data?.defaultFolderId;
      if (!ws || !folderId) throw new Error("no-notes");
      const plain = reviseNoteBodyFromChunk(c, i);
      const doc = plainTextToTipTapDoc(plain);
      const preview = extractPreviewFromDoc(doc);
      const titleBase = (c.summary?.trim() || `Mail Clerk draft ${i + 1}`).slice(0, 400);
      const note = await createNote({
        workspaceId: ws,
        folderId,
        title: `Draft: ${titleBase}`.slice(0, 500),
        contentJson: doc,
        previewText: preview || null,
        routingSource: "mail_clerk_revise",
      });
      return { noteId: note.id, notesWorkspaceId: ws };
    },
    onSuccess: (data) => {
      setPlanChunkError(null);
      queryClient.invalidateQueries({ queryKey: ["notes-app"] });
      markRoutedGlow({
        kind: "note",
        id: data.noteId,
        workspaceId: data.notesWorkspaceId,
      });
      pushRoutingToast({
        message: "Draft note created in Notebooks — highlighted until you open it.",
        undo: async () => {
          await deleteNote(data.noteId);
          clearRoutedGlow("note", data.noteId, data.notesWorkspaceId);
          void queryClient.invalidateQueries({ queryKey: ["notes-app"] });
        },
      });
    },
    onError: () => {
      setPlanChunkError(
        "Could not create a draft note — ensure notebooks are loaded and pick a notebook folder for this part.",
      );
      window.setTimeout(() => setPlanChunkError(null), 7000);
    },
  });

  const routingHoldsQuery = useQuery({
    queryKey: ["routing-holds", activeWorkspaceId],
    queryFn: () => fetchRoutingHolds(activeWorkspaceId!),
    enabled: Boolean(activeWorkspaceId) && !workspacesLoading,
  });

  const holdMutation = useMutation({
    mutationFn: (input: { body: string; source: "rapid_router" | "mail_clerk_plan"; meta?: unknown }) => {
      if (!activeWorkspaceId) throw new Error("no-workspace");
      return createRoutingHold(activeWorkspaceId, input);
    },
    onSuccess: (hold) => {
      if (activeWorkspaceId) {
        void queryClient.invalidateQueries({ queryKey: ["routing-holds", activeWorkspaceId] });
      }
      const ws = hold.workspaceId;
      pushRoutingToast({
        message: "Capture queued in the holding pen.",
        undo: async () => {
          await deleteRoutingHold(ws, hold.id);
          void queryClient.invalidateQueries({ queryKey: ["routing-holds", ws] });
        },
      });
    },
  });

  const holdDismissMutation = useMutation({
    mutationFn: (holdId: string) => {
      if (!activeWorkspaceId) throw new Error("no-workspace");
      return patchRoutingHold(activeWorkspaceId, holdId, { status: "dismissed" });
    },
    onSuccess: () => {
      if (activeWorkspaceId) {
        void queryClient.invalidateQueries({ queryKey: ["routing-holds", activeWorkspaceId] });
      }
    },
  });

  const holdRoutedMutation = useMutation({
    mutationFn: (holdId: string) => {
      if (!activeWorkspaceId) throw new Error("no-workspace");
      return patchRoutingHold(activeWorkspaceId, holdId, { status: "routed" });
    },
    onSuccess: () => {
      if (activeWorkspaceId) {
        void queryClient.invalidateQueries({ queryKey: ["routing-holds", activeWorkspaceId] });
      }
    },
  });

  const captureMutation = useMutation({
    mutationFn: async () => {
      const raw = text.trim();
      if (!raw) throw new Error("empty");

      if (destination === "brandCenter") {
        if (!activeWorkspaceId) throw new Error("no-workspace");
        const entry = appendRapidRouterBrandCapture(raw, activeWorkspaceId);
        if (!entry) throw new Error("brand-storage");
        return { where: "brandCenter" as const, brandEntryId: entry.id, workspaceId: activeWorkspaceId };
      }

      if (destination === "notes") {
        const ws = notesBootstrapQuery.data?.workspace.id;
        const folderId = notesFolderId ?? notesBootstrapQuery.data?.defaultFolderId;
        if (!ws || !folderId) throw new Error("no-notes");
        const doc = plainTextToTipTapDoc(raw);
        const preview = extractPreviewFromDoc(doc);
        const titleLine = raw.split("\n")[0]?.trim() || "Rapid note";
        const note = await createNote({
          workspaceId: ws,
          folderId,
          title: titleLine.slice(0, 500),
          contentJson: doc,
          previewText: preview || null,
          routingSource: "rapid_router",
        });
        return { where: "notes" as const, noteId: note.id, notesWorkspaceId: ws };
      }

      if (destination === "brainstorm") {
        if (!activeWorkspaceId) throw new Error("no-workspace");
        const { sessionId, nodeId } = await appendIdeaToBrainstorm(raw, activeWorkspaceId, brainstormSessionId);
        return {
          where: "brainstorm" as const,
          sessionId,
          nodeId,
          workspaceId: activeWorkspaceId,
        };
      }

      if (destination === "boards") {
        if (!boardsBoardId || !boardsListId) throw new Error("no-board-target");
        const { title, description } = splitTaskTitleDescription(raw);
        const task = await createBoardTask(boardsBoardId, {
          listId: boardsListId,
          title,
          ...(description ? { description } : {}),
          routingSource: "rapid_router",
        });
        return { where: "boards" as const, taskId: task.id, workspaceId: activeWorkspaceId! };
      }

      throw new Error("unknown-destination");
    },
    onSuccess: (result) => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["board"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
      queryClient.invalidateQueries({ queryKey: ["notes-app"] });
      queryClient.invalidateQueries({ queryKey: ["brainstorm"] });

      if (result.where === "notes") {
        markRoutedGlow({
          kind: "note",
          id: result.noteId,
          workspaceId: result.notesWorkspaceId,
        });
        pushRoutingToast({
          message: "Capture sent to Notebooks — highlighted until you interact with it.",
          undo: async () => {
            await deleteNote(result.noteId);
            clearRoutedGlow("note", result.noteId, result.notesWorkspaceId);
            void queryClient.invalidateQueries({ queryKey: ["notes-app"] });
          },
        });
        return;
      }

      if (result.where === "boards") {
        markRoutedGlow({
          kind: "task",
          id: result.taskId,
          workspaceId: result.workspaceId,
        });
        pushRoutingToast({
          message: "Capture added to Project boards — card highlighted until you interact with it.",
          undo: async () => {
            await patchTask(result.taskId, { archived: true });
            clearRoutedGlow("task", result.taskId, result.workspaceId);
            void queryClient.invalidateQueries({ queryKey: ["board"] });
            void queryClient.invalidateQueries({ queryKey: ["tasks", "flat"] });
          },
        });
        return;
      }

      if (result.where === "brainstorm") {
        markRoutedGlow({
          kind: "brainstorm",
          id: result.nodeId,
          workspaceId: result.workspaceId,
          sessionId: result.sessionId,
        });
        pushRoutingToast({
          message: "Capture added to Brainstorm — idea highlighted until you edit it.",
          undo: async () => {
            await removeBrainstormIdeaNode(result.workspaceId, result.sessionId, result.nodeId);
            clearRoutedGlow("brainstorm", result.nodeId, result.workspaceId, result.sessionId);
            void queryClient.invalidateQueries({ queryKey: ["brainstorm"] });
          },
        });
        return;
      }

      pushRoutingToast({
        message: "Capture saved to Brand Center on this device.",
        undo: async () => {
          removeRapidRouterBrandEntry(result.brandEntryId, result.workspaceId);
        },
      });
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
      (destination === "brainstorm" &&
        !!activeWorkspaceId &&
        !brainstormSessionsQuery.isLoading) ||
      (destination === "boards" && !!boardsBoardId && !!boardsListId));

  const anyMailChunkActionBusy =
    holdMutation.isPending ||
    routeChunkMutation.isPending ||
    reviseChunkNoteMutation.isPending ||
    mailDecomposeMutation.isPending ||
    mailRouteMutation.isPending;

  const selectedActionCount = useMemo(
    () => mailActionRows.filter((r) => r.selected && (r.summary.trim() || r.detail.trim())).length,
    [mailActionRows],
  );

  const selectClass =
    "border-input bg-background h-9 w-full rounded-md border px-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const textareaSmClass =
    "border-input bg-background placeholder:text-muted-foreground w-full resize-y rounded-md border px-2 py-1.5 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

      {workspacesLoading && (
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

        <form
        className="flex w-full min-w-0 flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) send();
          }}
        >
        <section className="min-w-0 space-y-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-x-6">
          <Label htmlFor="rapid-capture" className="text-foreground">
            Capture
          </Label>
          <span className="hidden lg:block" aria-hidden />
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-6">
          <div className="flex min-h-0 w-full min-w-0 flex-col lg:w-1/2 lg:shrink-0">
            <div className="relative">
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
                rows={12}
                className="border-input bg-card text-card-foreground placeholder:text-muted-foreground shadow-sm focus-visible:border-ring focus-visible:ring-ring/50 min-h-[20rem] w-full flex-1 resize-y rounded-lg border px-3 pt-2 pb-16 text-sm outline-none focus-visible:ring-[3px] lg:min-h-[24rem]"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 shadow-[0_10px_38px_-8px_rgba(0,0,0,0.28),0_4px_14px_-4px_rgba(0,0,0,0.12)] ring-1 ring-border/50 backdrop-blur-sm transition-shadow hover:shadow-[0_14px_44px_-8px_rgba(0,0,0,0.32),0_6px_18px_-4px_rgba(0,0,0,0.14)] dark:shadow-[0_12px_40px_-6px_rgba(0,0,0,0.65),0_4px_16px_-4px_rgba(0,0,0,0.45)] dark:hover:shadow-[0_16px_48px_-6px_rgba(0,0,0,0.7),0_6px_20px_-4px_rgba(0,0,0,0.5)]"
                onClick={sendCaptureToSticky}
                disabled={!text.trim()}
              >
                <StickyNote
                  className="mr-2 size-4 shrink-0 fill-yellow-400 stroke-amber-900 dark:fill-yellow-300 dark:stroke-amber-950"
                  strokeWidth={1.5}
                  aria-hidden
                />
              Send to Sticky Notes
            </Button>
            </div>
          </div>

        {activeWorkspaceId ? (
          <div className="flex w-full min-w-0 flex-col self-start lg:w-1/2">
            <RedTeamPanel workspaceId={activeWorkspaceId} captureMaterial={text} className="min-h-[24rem] w-full flex-1" />
          </div>
        ) : (
          <div className="flex min-h-[24rem] w-full flex-col items-center justify-center self-start rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground lg:w-1/2">
            Select a brand to use Agents (AI Tools, Red Team Agent, and AI Consultant).
          </div>
        )}
        </div>
      </section>

      <section className="w-full min-w-0 space-y-0 overflow-hidden rounded-xl border border-border bg-muted/10 p-4 sm:p-6">
        {activeWorkspaceId ? (
          <div className="border-b border-border/80 pb-1">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 rounded-md px-1 py-2 text-left transition-colors hover:bg-muted/40"
              onClick={() => setMailClerkRoutingOpen((o) => !o)}
              aria-expanded={mailClerkRoutingOpen}
            >
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <Mail className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <span className="block text-base font-semibold tracking-tight">Mail Clerk routing plan</span>
                  <p className="text-sm text-muted-foreground">
                    Two steps: scan the capture for every routable action, then let Mail Clerk assign destinations for
                    the lines you keep. Refine with Manual routing or the Mailroom wizard.
                  </p>
                </div>
              </div>
              {mailClerkRoutingOpen ? (
                <ChevronUp className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </button>
            {mailClerkRoutingOpen ? (
              <div className="space-y-4 pb-4 pt-2">
          <div className="space-y-2">
                  <Label htmlFor="mail-clerk-instruction">Operator instruction (optional)</Label>
                  <textarea
                    id="mail-clerk-instruction"
                    value={mailInstruction}
                    onChange={(e) => setMailInstruction(e.target.value)}
                    placeholder='e.g. "Prioritize the board backlog" or "Keep client names in notes only"'
                    rows={3}
                    className="border-input bg-background placeholder:text-muted-foreground w-full resize-y rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!redTeamContext.trim() || mailDecomposeMutation.isPending || mailRouteMutation.isPending}
                    onClick={() => mailDecomposeMutation.mutate()}
                  >
                    {mailDecomposeMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Scanning capture…
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 size-4" aria-hidden />
                        Step 1: Find routable actions
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    disabled={
                      mailPlan !== null ||
                      mailActionRows.length === 0 ||
                      selectedActionCount === 0 ||
                      mailDecomposeMutation.isPending ||
                      mailRouteMutation.isPending
                    }
                    onClick={() => mailRouteMutation.mutate()}
                  >
                    {mailRouteMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Assigning destinations…
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 size-4" aria-hidden />
                        Step 2: Assign destinations ({selectedActionCount} selected)
                      </>
                    )}
                  </Button>
                </div>
                {mailPlan ? (
            <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={mailRouteMutation.isPending || routeChunkMutation.isPending}
                      onClick={() => {
                        setMailPlan(null);
                        setChunkRoutes([]);
                        setPlanChunkError(null);
                      }}
                    >
                      ← Edit action list again
                    </Button>
                  </div>
                ) : null}
                {mailPlanError ? <p className="text-sm text-destructive">{mailPlanError}</p> : null}
                {planChunkError ? <p className="text-sm text-destructive">{planChunkError}</p> : null}
                {mailActionRows.length > 0 && !mailPlan ? (
                  <div className="rounded-xl border-2 border-dashed border-amber-500/35 bg-card/90 p-4 text-sm shadow-sm sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Step 1 — Routable actions from capture
                        </p>
                        {mailDecomposeSummary ? (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                            {mailDecomposeSummary}
                          </p>
                        ) : null}
                        <p className="text-sm text-muted-foreground">
                          {mailActionRows.length} candidate{mailActionRows.length === 1 ? "" : "s"} — select, edit, or
                          uncheck rows before step 2. Unchecked rows are not sent to Mail Clerk for routing.
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMailActionRows((rows) => rows.map((r) => ({ ...r, selected: true })))}
                        >
                          Select all
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMailActionRows((rows) => rows.map((r) => ({ ...r, selected: false })))}
                        >
                          Deselect all
                        </Button>
                      </div>
                    </div>
                    <ul className="mt-4 list-none space-y-3 p-0">
                      {mailActionRows.map((row) => (
                        <li
                          key={row.id}
                          className={cn(
                            "rounded-lg border border-border bg-muted/10 p-3 transition-opacity",
                            !row.selected && "opacity-60",
                          )}
                        >
                          <div className="flex flex-wrap items-start gap-3">
                            <label className="flex cursor-pointer items-start gap-2 pt-0.5">
                              <input
                                type="checkbox"
                                className="mt-1 size-4 shrink-0 rounded border-input"
                                checked={row.selected}
                                aria-label="Include this action in step 2 routing"
                                onChange={(e) =>
                                  setMailActionRows((prev) =>
                                    prev.map((r) => (r.id === row.id ? { ...r, selected: e.target.checked } : r)),
                                  )
                                }
                              />
                            </label>
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Title</Label>
                                <input
                                  type="text"
                                  value={row.summary}
                                  className={selectClass}
                                  onChange={(e) =>
                                    setMailActionRows((prev) =>
                                      prev.map((r) => (r.id === row.id ? { ...r, summary: e.target.value } : r)),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Details (optional)</Label>
                                <textarea
                                  value={row.detail}
                                  rows={3}
                                  className={textareaSmClass}
                                  onChange={(e) =>
                                    setMailActionRows((prev) =>
                                      prev.map((r) => (r.id === row.id ? { ...r, detail: e.target.value } : r)),
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-muted-foreground">
                      When you are ready, use{" "}
                      <span className="font-medium text-foreground">Step 2: Assign destinations</span> so Mail Clerk maps
                      each selected row to notebooks, boards, brainstorm, brand capture, or hold — using your operator
                      instruction and the workspace routing index.
                    </p>
                  </div>
                ) : null}
                {mailPlan ? (
                  <div className="space-y-4 rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                      {mailPlan.executiveSummary}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">
                      {mailPlan.chunks.length} actionable {mailPlan.chunks.length === 1 ? "part" : "parts"} — each card
                      below is routed separately.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Mail Clerk pre-fills each part&apos;s routing; adjust the dropdowns, then{" "}
                      <span className="font-medium text-foreground">Approve routing</span> to send. Use{" "}
                      <span className="font-medium text-foreground">Draft in Notebooks</span> to revise in a note first,{" "}
                      <span className="font-medium text-foreground">Holding pen</span> to queue, or the &quot;+ Add…&quot;
                      options to create spaces in the other apps.
                    </p>
                    <ul className="list-none space-y-4 p-0">
                      {mailPlan.chunks.map((c, i) => {
                        const routeThisPending =
                          routeChunkMutation.isPending && routeChunkMutation.variables?.i === i;
                        const reviseThisPending =
                          reviseChunkNoteMutation.isPending && reviseChunkNoteMutation.variables?.i === i;
                        const n = mailPlan.chunks.length;
                        const route = chunkRoutes[i];
                        const lists = mailChunkBoardQueries[i]?.data?.lists ?? [];
                        const draftFolderId =
                          route?.notesFolderId ?? notesBootstrapQuery.data?.defaultFolderId ?? "";
                        return (
                          <li
                            key={i}
                            className="rounded-lg border border-border bg-muted/15 p-4 text-muted-foreground shadow-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 text-foreground">
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Part {i + 1} of {n}
                              </span>
                              <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium capitalize text-foreground">
                                Mail clerk: {c.suggestedDestination.replace(/_/g, " ")} ·{" "}
                                {Math.round(c.confidence * 100)}%
                              </span>
                            </div>
                            <p className="mt-3 font-medium leading-snug text-foreground">
                              {c.summary || `Untitled chunk ${i + 1}`}
                            </p>
                            {c.targetHint ? (
                              <p className="mt-2 text-xs leading-relaxed">
                                <span className="font-medium text-muted-foreground">Target: </span>
                                <span className="break-all">{c.targetHint}</span>
                              </p>
                            ) : null}
                            {c.rationale ? (
                              <p className="mt-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
                                {c.rationale}
                              </p>
                            ) : null}

                            {route ? (
                              <div className="mt-4 space-y-3 rounded-md border border-dashed border-border/80 bg-background/80 p-3">
                                <p className="text-xs font-medium text-foreground">Your routing (editable)</p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs">Destination</Label>
                                    <select
                                      className={selectClass}
                                      value={route.category}
                                      onChange={(e) =>
                                        updateChunkRouteField(i, {
                                          category: e.target.value as MailroomPlanChunk["suggestedDestination"],
                                        })
                                      }
                                    >
                                      <option value="notes">Notebooks</option>
                                      <option value="boards">Project boards</option>
                                      <option value="brainstorm">Brainstorm</option>
                                      <option value="brand_center">Brand Center (this device)</option>
                                      <option value="hold">Holding pen</option>
                                      <option value="other">Other / undecided</option>
                                    </select>
                                  </div>

                                  {route.category === "notes" ? (
                                    <div className="space-y-1.5 sm:col-span-1">
                                      <Label className="text-xs">Notebook folder</Label>
                                      <select
                                        className={selectClass}
                                        value={route.notesFolderId ?? ""}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          if (v === MAIL_ADD_FOLDER) {
                                            navigate("/app/notes");
                                            return;
                                          }
                                          updateChunkRouteField(i, { notesFolderId: v || null });
                                        }}
                                      >
                                        {notesFolders.map((f) => (
                                          <option key={f.id} value={f.id}>
                                            {f.title}
                                          </option>
                                        ))}
                                        <option value={MAIL_ADD_FOLDER}>+ Add notebook folder…</option>
                                      </select>
                                    </div>
                                  ) : null}

                                  {route.category === "boards" ? (
                                    <>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs">Project board</Label>
                                        <select
                                          className={selectClass}
                                          value={route.boardsBoardId ?? ""}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            if (v === MAIL_ADD_BOARD) {
                                              navigate("/app/boards");
                                              return;
                                            }
                                            updateChunkRouteField(i, {
                                              boardsBoardId: v || null,
                                              boardsListId: null,
                                            });
                                          }}
                                        >
                                          {flatBoards.map((b) => (
                                            <option key={b.id} value={b.id}>
                                              {b.name} — {b.workspaceName}
                                            </option>
                                          ))}
                                          <option value={MAIL_ADD_BOARD}>+ Add project board / space…</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs">List</Label>
                                        <select
                                          className={selectClass}
                                          value={route.boardsListId ?? ""}
                                          disabled={!lists.length}
                                          onChange={(e) =>
                                            updateChunkRouteField(i, {
                                              boardsListId: e.target.value || null,
                                            })
                                          }
                                        >
                                          {lists.map((l) => (
                                            <option key={l.id} value={l.id}>
                                              {l.title}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </>
                                  ) : null}

                                  {route.category === "brainstorm" ? (
                                    <div className="space-y-1.5 sm:col-span-2">
                                      <Label className="text-xs">Brainstorm session</Label>
                                      <select
                                        className={selectClass}
                                        value={route.brainstormSessionId ?? ""}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          if (v === MAIL_ADD_SESSION) {
                                            navigate("/app/brainstorm");
                                            return;
                                          }
                                          updateChunkRouteField(i, { brainstormSessionId: v || null });
                                        }}
                                      >
                                        {brainstormSessions.map((s) => (
                                          <option key={s.id} value={s.id}>
                                            {s.title} ({s.nodeCount} nodes)
                                          </option>
                                        ))}
                                        <option value={MAIL_ADD_SESSION}>+ Add brainstorm session…</option>
                                      </select>
                                    </div>
                                  ) : null}

                                  {route.category === "brand_center" ? (
                                    <div className="space-y-1.5 sm:col-span-2">
                                      <Label className="text-xs">Brand action</Label>
                                      <select
                                        className={selectClass}
                                        value="capture"
                                        onChange={(e) => {
                                          if (e.target.value === "extend") {
                                            navigate("/app/brand-center");
                                          }
                                        }}
                                      >
                                        <option value="capture">
                                          Append to Brand Center capture (this device)
                                        </option>
                                        <option value="extend">+ Open Brand Center to extend the kit…</option>
                                      </select>
                                      <p className="text-[11px] text-muted-foreground">
                                        Capture uses the active brand context; extend the kit in Brand Center when
                                        nothing fits yet.
                                      </p>
                                    </div>
                                  ) : null}

                                  {(route.category === "hold" || route.category === "other") && (
                                    <p className="text-xs text-muted-foreground sm:col-span-2">
                                      {route.category === "other"
                                        ? "No confident match — this part will land in the holding pen until you decide."
                                        : "Queues this part in the holding pen for later routing."}
                                    </p>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  Need a new space?{" "}
                                  <Link className="text-primary underline underline-offset-2" to="/app/notes">
                                    Notebooks
                                  </Link>
                                  {" · "}
                                  <Link className="text-primary underline underline-offset-2" to="/app/boards">
                                    Project boards
                                  </Link>
                                  {" · "}
                                  <Link className="text-primary underline underline-offset-2" to="/app/brainstorm">
                                    Brainstorm
                                  </Link>
                                  {" · "}
                                  <Link className="text-primary underline underline-offset-2" to="/app/brand-center">
                                    Brand Center
                                  </Link>
                                </p>
                              </div>
                            ) : null}

                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="text-xs"
                                disabled={anyMailChunkActionBusy || !route}
                                onClick={() => route && routeChunkMutation.mutate({ c, i, route })}
                              >
                                {routeThisPending ? (
                                  <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <Send className="mr-2 size-3.5" aria-hidden />
                                )}
                                Approve routing
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="text-xs"
                                disabled={anyMailChunkActionBusy || !draftFolderId}
                                onClick={() =>
                                  reviseChunkNoteMutation.mutate({
                                    c,
                                    i,
                                    folderId: draftFolderId,
                                  })
                                }
                              >
                                {reviseThisPending ? (
                                  <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <FilePenLine className="mr-2 size-3.5" aria-hidden />
                                )}
                                Draft in Notebooks
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                disabled={anyMailChunkActionBusy}
                                onClick={() =>
                                  holdMutation.mutate({
                                    body: chunkToHoldBody(c, i),
                                    source: "mail_clerk_plan",
                                    meta: chunkHoldMeta(c, i),
                                  })
                                }
                              >
                                {holdMutation.isPending ? (
                                  <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <Inbox className="mr-2 size-3.5" aria-hidden />
                                )}
                                Queue in holding pen
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={cn(activeWorkspaceId && "border-t border-border/80 pt-1")}>
          <button
            type="button"
            className="flex w-full items-start justify-between gap-3 rounded-md px-1 py-2 text-left transition-colors hover:bg-muted/40"
            onClick={() => setManualRoutingPanelOpen((o) => !o)}
            aria-expanded={manualRoutingPanelOpen}
          >
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <RapidRouterIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 space-y-1">
                <span className="block text-base font-semibold tracking-tight">Manual Routing Plan</span>
                <p className="text-sm text-muted-foreground">
                  Send the capture to a destination by hand. Use Mail Clerk above when you want an AI-proposed split.
                </p>
              </div>
            </div>
            {manualRoutingPanelOpen ? (
              <ChevronUp className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
          </button>
          {manualRoutingPanelOpen ? (
            <div className="space-y-4 pb-2 pt-2">
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Destination</p>
                <div
                  className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
                  role="radiogroup"
                  aria-label="Manual routing destination"
                >
            <ManualRoutingOption
                active={destination === "brandCenter"}
                onClick={() => setDestination("brandCenter")}
                icon={Goal}
                label="Brand Center"
              />
            <ManualRoutingOption
                active={destination === "notes"}
                disabled={!notesReady}
                onClick={() => setDestination("notes")}
                icon={StickyNote}
              label="Notebooks"
              />
            <ManualRoutingOption
                active={destination === "brainstorm"}
                disabled={brainstormSessionsQuery.isLoading}
                onClick={() => setDestination("brainstorm")}
                icon={Lightbulb}
                label="Brainstorm"
              />
            <ManualRoutingOption
                active={destination === "boards"}
                disabled={!flatBoards.length}
                onClick={() => setDestination("boards")}
                icon={LayoutGrid}
              label="Project boards"
              />
            </div>
          </div>

        <div className="space-y-4 border-t border-border pt-4">
            {destination === "brandCenter" && (
              <p className="text-sm text-muted-foreground">
              Quick brand snippets — stored on this device for the active brand and combined with your saved{" "}
              <a href="/app/brand-center" className="font-medium text-foreground underline underline-offset-2">
                Brand Center
              </a>{" "}
              kit when you use AI. Use Brand Center for the full identity (mission, colors, logos, goals).
              </p>
            )}

          {destination === "boards" && !workspacesLoading && flatBoards.length === 0 && (
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
            </div>
          ) : null}
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

        {activeWorkspaceId ? (
          <div className="border-t border-border/80 pt-1">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 rounded-md px-1 py-2 text-left transition-colors hover:bg-muted/40"
              onClick={() => setHoldingPenOpen((o) => !o)}
              aria-expanded={holdingPenOpen}
            >
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <Inbox className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <span className="block text-base font-semibold tracking-tight">Holding pen</span>
                  <p className="text-sm text-muted-foreground">
                    Queue unresolved text server-side while you decide where it belongs. Dismiss entries when you have
                    routed them manually.
                  </p>
                </div>
              </div>
              {holdingPenOpen ? (
                <ChevronUp className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </button>
            {holdingPenOpen ? (
              <div className="space-y-4 pb-2 pt-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!redTeamContext.trim() || holdMutation.isPending}
                    onClick={() =>
                      holdMutation.mutate({
                        body: redTeamContext.trim(),
                        source: "rapid_router",
                      })
                    }
                  >
                    {holdMutation.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Inbox className="mr-2 size-4" aria-hidden />
                    )}
                    Queue capture in holding pen
                  </Button>
                </div>
                {routingHoldsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading queue…
                  </div>
                ) : routingHoldsQuery.data?.length ? (
                  <ul className="space-y-2">
                    {routingHoldsQuery.data.map((h) => (
                      <li
                        key={h.id}
                        className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-sm shadow-sm sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="whitespace-pre-wrap text-foreground">{h.body}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(h.createdAt).toLocaleString()} · {h.source}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={holdRoutedMutation.isPending || holdDismissMutation.isPending}
                            onClick={() => holdRoutedMutation.mutate(h.id)}
                          >
                            Mark routed
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={holdRoutedMutation.isPending || holdDismissMutation.isPending}
                            onClick={() => holdDismissMutation.mutate(h.id)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No pending items in the holding pen.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      </form>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <StickyNote className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold tracking-tight">Sticky notes</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Quick scratch cards stored in this browser per active brand — not synced to the server. Use the arrow to copy
          into Capture.
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

      {activeWorkspaceId ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-6">
          <Button type="button" variant="outline" size="sm" onClick={() => openMailroom()}>
            Mailroom wizard
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/app/chat">Consultant Agent</Link>
          </Button>
        </div>
      ) : null}

    </div>
  );
}

function ManualRoutingOption({
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
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors",
        disabled && "cursor-not-allowed opacity-50",
        active
          ? "border-primary/70 bg-primary/5 font-medium text-foreground shadow-sm"
          : "border-border/80 bg-card text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
