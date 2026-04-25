import { useMutation } from "@tanstack/react-query";
import { ArrowLeftRight, Goal, GripVertical, Loader2, Sparkles } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { DismissableLayerBranch } from "@radix-ui/react-dismissable-layer";
import {
  postBrandRepCenter,
  postBrandRepReview,
  type BrandRepCenterPayload,
  type ConsultScratchLogEntry,
} from "@/features/agents/api";
import {
  CONSULT_FIELD_WALK_ORDER,
  consultFieldIsFilled,
  findFirstConsultWalkBlankIndex,
  findNextConsultWalkBlankIndex,
  getConsultFieldValue,
  getNextConsultWalkFieldIndex,
  setConsultFieldValue,
} from "@/features/agents/brandConsultFields";
import { BrandConsultSingleFieldPane } from "@/features/agents/BrandConsultSingleFieldPane";
import { CONSULT_SECTIONS, type ConsultSectionId } from "@/features/agents/brandConsultSections";
import { mergeBrandProfilePatch, mergeBrandProfilePatchRecords } from "@/features/brand/mergeBrandProfilePatch";
import type { BrandProfile } from "@/features/brand/types";
import { normalizeBrandProfile } from "@/features/brand/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RightAppSheetResizeHandle, useResizableRightAppSheetWidth, rightAppSheetContentClassName } from "@/hooks/useResizableRightAppSheetWidth";
import { cn } from "@/lib/utils";

const KIT_SPLIT_STORAGE_KEY = "brandConsultSplitKitWidthPx";
const KIT_SPLIT_DEFAULT = 400;
const KIT_SPLIT_MIN = 260;
const KIT_SPLIT_MAX = 920;
const KIT_SPLIT_VIEWPORT_MARGIN = 40;

const textareaClass =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full min-h-[100px] resize-y rounded-lg border bg-transparent px-4 py-3 text-sm leading-relaxed shadow-xs outline-none focus-visible:ring-[3px]";

const otherConsiderationsTextareaClass =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full min-h-[120px] resize-y rounded-lg border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/** Scratch pad for “other” notes per field — compiled into official `otherBrandConsiderations` on that final step only. */
function ConsultScratchNoteEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="shrink-0 space-y-2 border-t border-border/60 bg-muted/20 px-4 py-4 md:px-5">
      <Label className="text-foreground">Additional thoughts for other brand considerations</Label>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Jot sensitivities, risks, or context for this field. This does <span className="font-medium text-foreground">not</span>{" "}
        change the official kit until the <strong>Other brand considerations</strong> step, when the Brand Rep compiles
        these notes with chat. <span className="font-medium text-foreground">Submit to Brand Center</span> saves the
        current field and archives this scratch line for that step.
      </p>
      <textarea
        className={otherConsiderationsTextareaClass}
        rows={5}
        value={value}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        placeholder="Partnerships, tooling, approvals, edge cases…"
      />
    </div>
  );
}

/** Tailwind `md` — split panes on wide screens; stacked flip on smaller viewports. */
const SPLIT_DESKTOP_MQ = "(min-width: 768px)";

function useSplitDesktopLayout() {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(SPLIT_DESKTOP_MQ).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(SPLIT_DESKTOP_MQ);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return matches;
}

type ChatLine = { role: "user" | "assistant"; text: string };

function mergePendingProfilePatches(
  prev: Record<string, unknown> | null,
  incoming: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!incoming || Object.keys(incoming).length === 0) return prev;
  if (!prev || Object.keys(prev).length === 0) return incoming;
  return mergeBrandProfilePatchRecords(prev, incoming);
}

function formatTranscript(lines: ChatLine[]): string {
  return lines
    .map((l) => (l.role === "user" ? `User: ${l.text}` : `Brand Rep: ${l.text}`))
    .join("\n\n")
    .slice(0, 12_000);
}

type BrandRepAgentSheetProps = {
  workspaceId: string | null | undefined;
  brandProfile: BrandProfile;
  onApplyProfilePatch: (next: BrandProfile) => void;
  /** Merges approved draft into the main form and forces an immediate server save. Rejects on validation failure. */
  onSubmitConsultToMain: (draft: BrandProfile) => Promise<void>;
};

export function BrandRepAgentSheet({
  workspaceId,
  brandProfile,
  onApplyProfilePatch,
  onSubmitConsultToMain,
}: BrandRepAgentSheetProps) {
  const splitDesktop = useSplitDesktopLayout();
  const [open, setOpen] = useState(false);
  /** Mobile / narrow: flip between consultation chat and inline kit fields (no left portal). */
  const [mobileConsultFace, setMobileConsultFace] = useState<"chat" | "kit">("chat");
  const { panelWidthPx, panelWidthRef, startResize, sheetWidthStyle } = useResizableRightAppSheetWidth({ open });
  const [kitSplitWidth, setKitSplitWidth] = useState(KIT_SPLIT_DEFAULT);
  const kitSplitWidthRef = useRef(kitSplitWidth);
  kitSplitWidthRef.current = kitSplitWidth;
  /** Ref on `DismissableLayerBranch` root (portaled kit pane). */
  const consultKitPaneRef = useRef<HTMLDivElement | null>(null);

  const kitSplitWidthPx = useMemo(() => {
    const w = Number.isFinite(kitSplitWidth) && kitSplitWidth > 0 ? kitSplitWidth : KIT_SPLIT_DEFAULT;
    const base = Math.min(KIT_SPLIT_MAX, Math.max(KIT_SPLIT_MIN, w));
    if (typeof window === "undefined") return base;
    const capByViewport = Math.max(
      KIT_SPLIT_MIN,
      window.innerWidth - panelWidthPx - KIT_SPLIT_VIEWPORT_MARGIN,
    );
    return Math.min(base, capByViewport);
  }, [kitSplitWidth, panelWidthPx]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KIT_SPLIT_STORAGE_KEY);
      const n = raw ? Number.parseInt(raw, 10) : NaN;
      if (Number.isFinite(n) && n >= KIT_SPLIT_MIN && n <= KIT_SPLIT_MAX) {
        setKitSplitWidth(n);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const startKitSplitResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = kitSplitWidthRef.current;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1600;
      const cap = Math.max(KIT_SPLIT_MIN, vw - panelWidthRef.current - KIT_SPLIT_VIEWPORT_MARGIN);
      const next = Math.min(cap, Math.max(KIT_SPLIT_MIN, startW + dx));
      kitSplitWidthRef.current = next;
      setKitSplitWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      try {
        localStorage.setItem(KIT_SPLIT_STORAGE_KEY, String(kitSplitWidthRef.current));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const [mainTab, setMainTab] = useState<"ask" | "consult" | "review">("consult");
  const [askLines, setAskLines] = useState<ChatLine[]>([]);
  const [consultLines, setConsultLines] = useState<ChatLine[]>([]);
  const [fieldWalkActive, setFieldWalkActive] = useState(false);
  /** Working kit while in field walk — committed to main Brand Center only via Submit. */
  const [workingProfile, setWorkingProfile] = useState<BrandProfile | null>(null);
  const [fieldWalkIdx, setFieldWalkIdx] = useState(0);
  const [askDraft, setAskDraft] = useState("");
  const [consultDraft, setConsultDraft] = useState("");
  const [reviewDraft, setReviewDraft] = useState("");
  const [reviewOut, setReviewOut] = useState("");
  const [pendingPatch, setPendingPatch] = useState<Record<string, unknown> | null>(null);
  const [consultScratchNote, setConsultScratchNote] = useState("");
  const [consultScratchLog, setConsultScratchLog] = useState<ConsultScratchLogEntry[]>([]);
  const consultScratchLogRef = useRef<ConsultScratchLogEntry[]>([]);
  const workingProfileRef = useRef<BrandProfile | null>(null);
  const fieldSnapshotRef = useRef<{ fieldId: string; value: string } | null>(null);
  const consultLinesRef = useRef<ChatLine[]>([]);
  const [consultSaveBusy, setConsultSaveBusy] = useState(false);
  const agentHubSessionRef = useRef<string | null>(null);
  /** When true, automatic forward steps skip fields that already have text in the working draft. */
  const [consultOnlyBlankFields, setConsultOnlyBlankFields] = useState(false);
  const jumpNavIdKitPortal = useId();
  const jumpNavIdChat = useId();
  const jumpNavIdMobileKit = useId();
  const consultScopeIdKitPortal = useId();
  const consultScopeIdChat = useId();
  const consultScopeIdMobileKit = useId();

  const fieldWalkEntry = CONSULT_FIELD_WALK_ORDER[fieldWalkIdx];
  const fieldWalkComplete = fieldWalkActive && workingProfile !== null && fieldWalkIdx >= CONSULT_FIELD_WALK_ORDER.length;

  const showConsultKitPane =
    open && mainTab === "consult" && fieldWalkActive && workingProfile !== null && (fieldWalkEntry !== undefined || fieldWalkComplete);

  const useDesktopKitPortal = showConsultKitPane && splitDesktop;

  useEffect(() => {
    if (!showConsultKitPane) setMobileConsultFace("chat");
  }, [showConsultKitPane]);

  useEffect(() => {
    if (!open) agentHubSessionRef.current = null;
  }, [open]);

  const consultDraftForApi = fieldWalkActive && workingProfile ? workingProfile : brandProfile;

  workingProfileRef.current = workingProfile;
  consultScratchLogRef.current = consultScratchLog;
  consultLinesRef.current = consultLines;

  const callBrandRepCenter = useCallback(
    async (args: {
      mode: "ask" | "consult";
      userMessage: string;
      transcriptLines: ChatLine[];
      consultSectionId: ConsultSectionId;
      consultField?: (typeof CONSULT_FIELD_WALK_ORDER)[number];
      /** Use when React state for the working draft has not flushed yet (e.g. first field open). */
      draftOverride?: BrandProfile;
      /** When set, used for `otherBrandConsiderations` compile turns instead of React state. */
      consultScratchLogOverride?: ConsultScratchLogEntry[];
    }): Promise<BrandRepCenterPayload> => {
      const cf = args.consultField;
      const draftBody = args.draftOverride ?? consultDraftForApi;
      const scratchForObc =
        cf?.id === "otherBrandConsiderations"
          ? (args.consultScratchLogOverride ?? consultScratchLogRef.current)
          : undefined;
      const res = await postBrandRepCenter({
        workspaceId: workspaceId!,
        message: args.userMessage,
        mode: args.mode,
        consultSectionId: args.consultSectionId,
        transcript: formatTranscript(args.transcriptLines),
        brandProfileDraft: draftBody,
        agentSessionId: agentHubSessionRef.current,
        ...(cf
          ? {
              consultFieldId: cf.id,
              consultFieldLabel: cf.label,
              consultFieldSnippet: getConsultFieldValue(draftBody, cf.id).slice(0, 4000),
              consultFieldFilled: consultFieldIsFilled(draftBody, cf.id),
            }
          : {}),
        ...(scratchForObc && scratchForObc.length > 0 ? { consultScratchLog: scratchForObc } : {}),
      });
      if (res.agentSessionId) agentHubSessionRef.current = res.agentSessionId;
      const payload = res.brandRepCenter;
      if (!payload) throw new Error("Missing brandRepCenter payload");
      return payload;
    },
    [consultDraftForApi, workspaceId],
  );

  const centerPending = useMutation({
    mutationFn: callBrandRepCenter,
  });

  const reviewMut = useMutation({
    mutationFn: () =>
      postBrandRepReview({
        workspaceId: workspaceId!,
        message: reviewDraft,
        agentSessionId: agentHubSessionRef.current,
      }),
    onSuccess: (d) => {
      setReviewOut(d.result);
      if (d.agentSessionId) agentHubSessionRef.current = d.agentSessionId;
    },
  });

  const applyPendingPatch = useCallback(() => {
    if (!pendingPatch) return;
    onApplyProfilePatch(mergeBrandProfilePatch(brandProfile, pendingPatch));
    setPendingPatch(null);
  }, [brandProfile, onApplyProfilePatch, pendingPatch]);

  const openFieldTurn = useCallback(
    async (idx: number, transcriptLines: ChatLine[], userMessage: string, draftOverride?: BrandProfile) => {
      if (!workspaceId) return;
      const entry = CONSULT_FIELD_WALK_ORDER[idx];
      if (!entry) return;
      const payload = await centerPending.mutateAsync({
        mode: "consult",
        userMessage,
        transcriptLines,
        consultSectionId: entry.sectionId as ConsultSectionId,
        consultField: entry,
        draftOverride,
      });
      setConsultLines((prev) => [...prev, { role: "assistant", text: payload.assistantMessage }]);
      setPendingPatch((prevPatch) => mergePendingProfilePatches(prevPatch, payload.proposedProfilePatch ?? null));
    },
    [centerPending, workspaceId],
  );

  const goToConsultFieldIndex = useCallback(
    async (targetIdx: number) => {
      if (!workspaceId || !fieldWalkActive) return;
      const lastField = CONSULT_FIELD_WALK_ORDER.length - 1;
      if (targetIdx < 0 || targetIdx > lastField) return;
      if (targetIdx === fieldWalkIdx && !fieldWalkComplete) return;

      const entry = CONSULT_FIELD_WALK_ORDER[targetIdx];
      if (!entry) return;

      const prevIdx = fieldWalkIdx;
      const line: ChatLine = { role: "user", text: `— Go to: ${entry.label} —` };
      const prior = [...consultLinesRef.current, line];
      setConsultLines(prior);
      setFieldWalkIdx(targetIdx);
      setPendingPatch(null);
      setConsultScratchNote("");
      setMobileConsultFace("chat");
      try {
        await openFieldTurn(targetIdx, prior, "__OPEN_FIELD__");
      } catch {
        setConsultLines((p) => p.slice(0, -1));
        setFieldWalkIdx(prevIdx);
      }
    },
    [fieldWalkActive, fieldWalkComplete, fieldWalkIdx, openFieldTurn, workspaceId],
  );

  const beginFieldWalk = useCallback(async () => {
    if (!workspaceId) return;
    const draft = normalizeBrandProfile(JSON.parse(JSON.stringify(brandProfile)) as BrandProfile);
    setWorkingProfile(draft);
    setFieldWalkActive(true);
    setConsultLines([]);
    setConsultDraft("");
    setPendingPatch(null);
    setConsultScratchNote("");
    setConsultScratchLog([]);
    consultScratchLogRef.current = [];

    const startIdx = consultOnlyBlankFields ? findFirstConsultWalkBlankIndex(draft) : 0;
    const len = CONSULT_FIELD_WALK_ORDER.length;

    if (consultOnlyBlankFields && startIdx === null) {
      setFieldWalkIdx(len);
      setConsultLines([
        {
          role: "assistant",
          text: "Every field in this walk already has text in your working draft. Turn off **Only consult on blank fields** to review any field, or use **Go to question** to open one anyway.",
        },
      ]);
      return;
    }

    const idx = startIdx ?? 0;
    setFieldWalkIdx(idx);
    try {
      await openFieldTurn(idx, [], "__OPEN_FIELD__", draft);
    } catch {
      setFieldWalkActive(false);
      setWorkingProfile(null);
      setConsultLines([]);
      setConsultScratchNote("");
      setConsultScratchLog([]);
      consultScratchLogRef.current = [];
      setFieldWalkIdx(0);
    }
  }, [brandProfile, consultOnlyBlankFields, openFieldTurn, workspaceId]);

  const sendAsk = useCallback(async () => {
    const t = askDraft.trim();
    if (!t || !workspaceId) return;
    setAskDraft("");
    const userLine: ChatLine = { role: "user", text: t };
    setAskLines((prev) => [...prev, userLine]);
    try {
      const payload = await centerPending.mutateAsync({
        mode: "ask",
        userMessage: t,
        transcriptLines: askLines,
        consultSectionId: "discovery",
      });
      setAskLines((prev) => [...prev, { role: "assistant", text: payload.assistantMessage }]);
    } catch {
      setAskLines((prev) => prev.slice(0, -1));
    }
  }, [askDraft, askLines, centerPending, workspaceId]);

  const sendConsult = useCallback(async () => {
    const t = consultDraft.trim();
    if (!t || !workspaceId) return;
    if (!fieldWalkEntry) return;
    setConsultDraft("");
    const userLine: ChatLine = { role: "user", text: t };
    const prior = [...consultLines, userLine];
    setConsultLines(prior);
    try {
      const payload = await centerPending.mutateAsync({
        mode: "consult",
        userMessage: t,
        transcriptLines: prior,
        consultSectionId: fieldWalkEntry.sectionId as ConsultSectionId,
        consultField: fieldWalkEntry,
      });
      setConsultLines((prev) => [...prev, { role: "assistant", text: payload.assistantMessage }]);
      setPendingPatch((prevPatch) => mergePendingProfilePatches(prevPatch, payload.proposedProfilePatch ?? null));
    } catch {
      setConsultLines((prev) => prev.slice(0, -1));
    }
  }, [centerPending, consultDraft, consultLines, fieldWalkEntry, workspaceId]);

  const advanceToNextField = useCallback(
    async (transcriptAfter: ChatLine[], draftForAdvance?: BrandProfile) => {
      const wp = draftForAdvance ?? workingProfileRef.current;
      if (!wp) return;
      const fromIdx = fieldWalkIdx;
      const nextIdx = getNextConsultWalkFieldIndex(wp, fromIdx, consultOnlyBlankFields);
      setFieldWalkIdx(nextIdx);
      setPendingPatch(null);
      setMobileConsultFace("chat");
      if (nextIdx >= CONSULT_FIELD_WALK_ORDER.length) {
        const anyBlank = findFirstConsultWalkBlankIndex(wp) !== null;
        const assistantText =
          consultOnlyBlankFields && anyBlank
            ? "No more **blank** fields ahead in walk order from here. There are still empty fields you can open with **Go to question**, or turn off **Only consult on blank fields** to move field-by-field. When you are done, use **Submit to Brand Center**."
            : consultOnlyBlankFields && !anyBlank
              ? "Every field in this walk already has text (blank-only scope). Turn off **Only consult on blank fields** to revisit any field, or **Submit to Brand Center** when ready."
              : "That completes every field in the walk. Tweak **Other brand considerations** in the kit if needed, then use **Submit to Brand Center** to update the live kit and save immediately.";
        setConsultLines((prev) => [...prev, { role: "assistant", text: assistantText }]);
        return;
      }
      try {
        await openFieldTurn(nextIdx, transcriptAfter, "__OPEN_FIELD__", wp);
      } catch {
        setFieldWalkIdx(fromIdx);
      }
    },
    [consultOnlyBlankFields, fieldWalkIdx, openFieldTurn],
  );

  const submitToBrandCenter = useCallback(async () => {
    if (!workingProfile) return;
    const merged = pendingPatch ? mergeBrandProfilePatch(workingProfile, pendingPatch) : workingProfile;
    const normalized = normalizeBrandProfile(merged);
    setConsultSaveBusy(true);
    try {
      await onSubmitConsultToMain(normalized);
    } catch {
      return;
    } finally {
      setConsultSaveBusy(false);
    }
    setWorkingProfile(normalized);
    setPendingPatch(null);

    const atEnd = !fieldWalkEntry || fieldWalkIdx >= CONSULT_FIELD_WALK_ORDER.length;
    if (atEnd) {
      setConsultScratchNote("");
      setConsultScratchLog([]);
      consultScratchLogRef.current = [];
      setFieldWalkActive(false);
      setWorkingProfile(null);
      setConsultLines([]);
      setFieldWalkIdx(0);
      setMobileConsultFace("chat");
      return;
    }

    const entry = fieldWalkEntry;
    const row: ConsultScratchLogEntry = {
      fieldId: entry.id,
      fieldLabel: entry.label,
      note: consultScratchNote.trim(),
    };
    const nextLog = [...consultScratchLogRef.current, row];
    consultScratchLogRef.current = nextLog;
    setConsultScratchLog(nextLog);
    setConsultScratchNote("");

    const ack: ChatLine = { role: "user", text: "— Submitted to Brand Center —" };
    const transcriptAfter = [...consultLinesRef.current, ack];
    setConsultLines(transcriptAfter);
    await advanceToNextField(transcriptAfter, normalized);
  }, [
    advanceToNextField,
    consultLines,
    consultScratchNote,
    fieldWalkEntry,
    fieldWalkIdx,
    onSubmitConsultToMain,
    pendingPatch,
    workingProfile,
  ]);

  const skipThisQuestion = useCallback(async () => {
    if (!workingProfile || !fieldWalkEntry || fieldWalkComplete || centerPending.isPending) return;
    const snap = fieldSnapshotRef.current;
    let restored: BrandProfile = workingProfile;
    if (snap && snap.fieldId === fieldWalkEntry.id) {
      restored = setConsultFieldValue(workingProfile, snap.fieldId, snap.value);
      setWorkingProfile(restored);
    }
    setPendingPatch(null);
    setConsultScratchNote("");
    const ack: ChatLine = { role: "user", text: "— Skipped this question —" };
    const transcriptAfter = [...consultLinesRef.current, ack];
    setConsultLines(transcriptAfter);
    await advanceToNextField(transcriptAfter, restored);
  }, [advanceToNextField, centerPending.isPending, fieldWalkComplete, fieldWalkEntry, workingProfile]);

  const sendGenerateField = useCallback(async () => {
    if (!workspaceId || !fieldWalkEntry || fieldWalkComplete || centerPending.isPending) return;
    const displayLine: ChatLine = { role: "user", text: "Generate suggested copy" };
    const priorDisplay = [...consultLines, displayLine];
    setConsultLines(priorDisplay);
    const forApi: ChatLine[] = [...consultLines, { role: "user", text: "__GENERATE_FIELD__" }];
    try {
      const payload = await centerPending.mutateAsync({
        mode: "consult",
        userMessage: "__GENERATE_FIELD__",
        transcriptLines: forApi,
        consultSectionId: fieldWalkEntry.sectionId as ConsultSectionId,
        consultField: fieldWalkEntry,
      });
      setConsultLines((prev) => [...prev, { role: "assistant", text: payload.assistantMessage }]);
      const incoming = payload.proposedProfilePatch;
      const incomingKeys = incoming && typeof incoming === "object" && !Array.isArray(incoming) ? Object.keys(incoming) : [];
      setWorkingProfile((wp) => {
        if (!wp) return wp;
        let base = pendingPatch ? mergeBrandProfilePatch(wp, pendingPatch) : wp;
        if (incomingKeys.length > 0) {
          base = mergeBrandProfilePatch(base, incoming as Record<string, unknown>);
        }
        return normalizeBrandProfile(base);
      });
      setPendingPatch(null);
    } catch {
      setConsultLines((prev) => prev.slice(0, -1));
    }
  }, [centerPending, consultLines, fieldWalkComplete, fieldWalkEntry, pendingPatch, workspaceId]);

  const resetConsultation = useCallback(() => {
    setConsultLines([]);
    setConsultDraft("");
    setFieldWalkIdx(0);
    setFieldWalkActive(false);
    setWorkingProfile(null);
    setPendingPatch(null);
    setConsultScratchNote("");
    setConsultScratchLog([]);
    consultScratchLogRef.current = [];
    setConsultOnlyBlankFields(false);
    setMobileConsultFace("chat");
  }, []);

  const setWorkingProfileNonNull = useCallback((action: SetStateAction<BrandProfile>) => {
    setWorkingProfile((prev) => {
      if (prev == null) return prev;
      return typeof action === "function" ? (action as (p: BrandProfile) => BrandProfile)(prev) : action;
    });
  }, []);

  useEffect(() => {
    if (!fieldWalkActive) {
      fieldSnapshotRef.current = null;
      return;
    }
    const wp = workingProfileRef.current;
    if (!wp || fieldWalkIdx >= CONSULT_FIELD_WALK_ORDER.length) {
      fieldSnapshotRef.current = null;
      return;
    }
    const e = CONSULT_FIELD_WALK_ORDER[fieldWalkIdx];
    if (!e) return;
    fieldSnapshotRef.current = { fieldId: e.id, value: getConsultFieldValue(wp, e.id) };
  }, [fieldWalkIdx, fieldWalkActive]);

  const sectionLabel = useMemo(() => {
    if (!fieldWalkEntry) return null;
    return CONSULT_SECTIONS.find((s) => s.id === fieldWalkEntry.sectionId)?.label ?? null;
  }, [fieldWalkEntry]);

  const renderConsultJumpNav = (selectId: string) =>
    fieldWalkActive ? (
      <div className="space-y-1.5">
        <Label htmlFor={selectId} className="text-xs text-muted-foreground">
          Go to question
        </Label>
        <select
          id={selectId}
          className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full max-w-full rounded-md border px-2 text-xs shadow-xs outline-none focus-visible:ring-[3px]"
          disabled={centerPending.isPending || consultSaveBusy}
          value={fieldWalkIdx < CONSULT_FIELD_WALK_ORDER.length ? String(fieldWalkIdx) : ""}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            const raw = e.target.value;
            if (raw === "") return;
            const n = Number.parseInt(raw, 10);
            if (!Number.isFinite(n)) return;
            void goToConsultFieldIndex(n);
          }}
        >
          {fieldWalkComplete ? (
            <option value="">Return to a question…</option>
          ) : (
            <option value="" disabled>
              Jump to any question…
            </option>
          )}
          {CONSULT_FIELD_WALK_ORDER.map((f, i) => (
            <option key={f.id} value={String(i)}>
              {i + 1}. {f.label}
            </option>
          ))}
        </select>
      </div>
    ) : null;

  const renderConsultScopeSelect = (selectId: string) =>
    fieldWalkActive ? (
      <div className="space-y-1.5">
        <Label htmlFor={selectId} className="text-xs text-muted-foreground">
          Field scope
        </Label>
        <select
          id={selectId}
          className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full max-w-full rounded-md border px-2 text-xs shadow-xs outline-none focus-visible:ring-[3px]"
          disabled={centerPending.isPending || consultSaveBusy}
          value={consultOnlyBlankFields ? "blank" : "all"}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            const blank = e.target.value === "blank";
            setConsultOnlyBlankFields(blank);
            if (!blank || !fieldWalkActive) return;
            const wp = workingProfileRef.current;
            if (!wp) return;
            const idx = fieldWalkIdx;
            if (idx >= CONSULT_FIELD_WALK_ORDER.length) return;
            const cur = CONSULT_FIELD_WALK_ORDER[idx];
            if (!cur || !consultFieldIsFilled(wp, cur.id)) return;
            const n = findNextConsultWalkBlankIndex(wp, idx);
            if (n !== null) {
              void goToConsultFieldIndex(n);
            } else {
              const len = CONSULT_FIELD_WALK_ORDER.length;
              setFieldWalkIdx(len);
              setPendingPatch(null);
              setConsultLines((prev) => [
                ...prev,
                { role: "user", text: "— Blank-only: no empty fields ahead in walk order —" },
                {
                  role: "assistant",
                  text: "There are no blank fields later in the walk from this step. Use **Go to question** for an earlier empty field, or turn off **Only consult on blank fields**.",
                },
              ]);
            }
          }}
        >
          <option value="all">All fields (in order)</option>
          <option value="blank">Only consult on blank fields</option>
        </select>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Blank-only skips fields that already have text when you submit, skip, or move forward. You can still open any
          field with **Go to question**.
        </p>
      </div>
    ) : null;

  if (!workspaceId) return null;

  const tabBtn = (id: typeof mainTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setMainTab(id)}
      className={
        mainTab === id
          ? "rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
          : "rounded-md px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
      }
    >
      {label}
    </button>
  );

  const consultKitPortal =
    typeof document !== "undefined" && useDesktopKitPortal
      ? createPortal(
          <DismissableLayerBranch
            ref={consultKitPaneRef}
            data-brand-consult-kit-pane
            className="pointer-events-auto fixed inset-y-0 left-0 z-[52] flex flex-col overflow-hidden border-r border-border bg-popover text-popover-foreground shadow-xl"
            style={{ width: `${kitSplitWidthPx}px` }}
          >
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Drag to resize kit pane"
              title="Drag to resize"
              className="absolute top-0 right-0 bottom-0 z-[1] hidden w-4 cursor-col-resize touch-none items-center justify-center border-l border-transparent hover:border-border hover:bg-muted/50 active:bg-muted md:flex"
              onMouseDown={startKitSplitResize}
            >
              <GripVertical className="size-4 text-muted-foreground opacity-70" aria-hidden />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden pr-3">
              <div className="shrink-0 space-y-2 border-b border-border/60 px-5 py-3 pr-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Working draft</p>
                {sectionLabel ? (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{sectionLabel}</p>
                ) : null}
                {fieldWalkEntry ? (
                  <p className="text-sm font-medium text-foreground">
                    Field {fieldWalkIdx + 1} of {CONSULT_FIELD_WALK_ORDER.length}: {fieldWalkEntry.label}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-foreground">All fields reviewed</p>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Edit the current field in this pane. <strong>Submit to Brand Center</strong> updates the live kit, saves
                  immediately, and moves to the next field. <strong>Skip this question</strong> leaves this field as it was
                  when you opened it (no agent merge). Use <strong>Generate</strong> in chat for a suggested pass.{" "}
                  <strong>Go to question</strong> opens any field in the walk. <strong>Field scope</strong> can limit automatic
                  forward moves to blank fields only.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={consultSaveBusy || !workingProfile}
                  onClick={() => void submitToBrandCenter()}
                >
                  {consultSaveBusy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    "Submit to Brand Center"
                  )}
                </Button>
                {fieldWalkActive && fieldWalkEntry && !fieldWalkComplete ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={centerPending.isPending || consultSaveBusy}
                    onClick={() => void skipThisQuestion()}
                  >
                    Skip this question
                  </Button>
                ) : null}
                {renderConsultScopeSelect(consultScopeIdKitPortal)}
                {renderConsultJumpNav(jumpNavIdKitPortal)}
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                  {workingProfile && fieldWalkEntry ? (
                    <BrandConsultSingleFieldPane
                      fieldId={fieldWalkEntry.id}
                      profile={workingProfile}
                      setProfile={setWorkingProfileNonNull}
                    />
                  ) : workingProfile && fieldWalkComplete ? (
                    <div className="space-y-3">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Walk complete. Adjust <strong>Other brand considerations</strong> here if needed, then{" "}
                        <strong>Submit to Brand Center</strong> to sync the live kit and save.
                      </p>
                      <BrandConsultSingleFieldPane
                        fieldId="otherBrandConsiderations"
                        profile={workingProfile}
                        setProfile={setWorkingProfileNonNull}
                      />
                    </div>
                  ) : null}
                </div>
                {fieldWalkActive && fieldWalkEntry && fieldWalkEntry.id !== "otherBrandConsiderations" ? (
                  <ConsultScratchNoteEditor value={consultScratchNote} onChange={setConsultScratchNote} />
                ) : null}
              </div>
            </div>
          </DismissableLayerBranch>,
          document.body,
        )
      : null;

  /** `modal={false}` disables Radix's overlay; add our own scrim so the page blurs like Rapid Router (`backdrop-blur-sm`). z-[49] sits under the sheet (50) and kit pane (52) so those stay sharp. */
  const brandRepBackdropPortal =
    open && typeof document !== "undefined"
      ? createPortal(
          <button
            type="button"
            aria-label="Close Brand Rep Agent"
            className="fixed inset-0 z-[49] cursor-default border-0 bg-black/10 p-0 backdrop-blur-sm outline-none transition-opacity duration-100 supports-backdrop-filter:bg-black/10 dark:bg-black/20"
            onClick={() => setOpen(false)}
          />,
          document.body,
        )
      : null;

  return (
    <>
      {brandRepBackdropPortal}
      <Sheet open={open} onOpenChange={setOpen} modal={false}>
      {consultKitPortal}
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Goal className="size-4" aria-hidden />
          Brand Rep Agent
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className={cn(rightAppSheetContentClassName, "overflow-y-auto")}
        style={sheetWidthStyle}
      >
        <RightAppSheetResizeHandle
          onMouseDown={startResize}
          className="hidden md:flex"
        />

        <SheetHeader className="gap-3 border-b border-border/60 px-6 pb-7 pl-10 pr-7 pt-6 sm:gap-3.5 sm:px-8 sm:pb-9 sm:pl-12 sm:pr-10 sm:pt-7">
          <SheetTitle className="text-lg">Brand Rep Agent</SheetTitle>
          <SheetDescription className="text-sm leading-relaxed">
            Brand strategy, positioning, voice, and kit building — structured as a <strong>brand operating system</strong>{" "}
            walkthrough so the kit can feed agents and execution. The agent treats the <strong>Brand Center form</strong>{" "}
            (all kit fields on this page, including your unsaved edits) as the primary workspace dialogue, plus what you
            type in the chat here.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-6 pb-8 pl-10 pr-7 pt-5 sm:gap-7 sm:px-8 sm:pb-10 sm:pl-12 sm:pr-10 sm:pt-6">
        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/30 p-2 sm:p-2.5">
          {tabBtn("consult", "Consultation")}
          {tabBtn("ask", "Ask a question")}
          {tabBtn("review", "Review copy")}
        </div>

        {mainTab === "ask" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Open-ended Q&amp;A with a senior brand strategist. Context is the Brand Center kit on this page plus your
              messages here; answers do not auto-edit your kit.
            </p>
            <div className="max-h-[42vh] min-h-[140px] flex-1 space-y-3 overflow-y-auto overscroll-y-contain rounded-xl border border-border bg-muted/20 p-4 text-sm sm:p-5">
              {askLines.length === 0 ? (
                <p className="leading-relaxed text-muted-foreground">Ask about naming, positioning, narrative arcs, channel fit…</p>
              ) : (
                askLines.map((l, i) => (
                  <div
                    key={`${i}-${l.role}`}
                    className={
                      l.role === "user"
                        ? "ml-2 rounded-xl bg-primary/10 px-4 py-3 sm:ml-4 sm:px-5 sm:py-3.5"
                        : "mr-2 rounded-xl border border-transparent px-1 py-1 sm:mr-4"
                    }
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {l.role === "user" ? "You" : "Brand Rep"}
                    </span>
                    <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{l.text}</p>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-3">
              <Label htmlFor="brand-rep-ask" className="text-sm">
                Your question
              </Label>
              <textarea
                id="brand-rep-ask"
                className={textareaClass}
                rows={3}
                value={askDraft}
                onChange={(e) => setAskDraft(e.target.value)}
                disabled={centerPending.isPending}
                placeholder="e.g. Is our differentiator too technical for the buyer we described?"
              />
              <Button
                type="button"
                className="mt-1"
                disabled={!askDraft.trim() || centerPending.isPending}
                onClick={() => void sendAsk()}
              >
                {centerPending.isPending && mainTab === "ask" ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Thinking…
                  </>
                ) : (
                  "Send"
                )}
              </Button>
            </div>
          </div>
        ) : null}

        {mainTab === "consult" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span className="min-w-0 leading-relaxed">
                {fieldWalkActive && fieldWalkEntry ? (
                  <>
                    Field {fieldWalkIdx + 1} of {CONSULT_FIELD_WALK_ORDER.length}:{" "}
                    <span className="font-medium text-foreground">{fieldWalkEntry.label}</span>
                    {sectionLabel ? (
                      <span className="mt-0.5 block text-xs font-medium text-primary">{sectionLabel}</span>
                    ) : null}
                  </>
                ) : fieldWalkActive && fieldWalkComplete ? (
                  <span className="font-medium text-foreground">Field walk complete</span>
                ) : (
                  <span className="font-medium text-foreground">Brand kit consultation</span>
                )}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0 text-xs" onClick={resetConsultation}>
                  Reset
                </Button>
                {!fieldWalkActive ? (
                  <Button type="button" size="sm" className="h-9 shrink-0 text-xs" onClick={() => void beginFieldWalk()}>
                    Start Consultation
                  </Button>
                ) : null}
              </div>
            </div>

            {fieldWalkActive ? (
              <div className="flex max-w-md flex-col gap-3">
                {renderConsultScopeSelect(consultScopeIdChat)}
                {renderConsultJumpNav(jumpNavIdChat)}
              </div>
            ) : null}

            {showConsultKitPane && !splitDesktop ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5 md:hidden">
                <span className="text-xs font-medium text-foreground">
                  {mobileConsultFace === "chat" ? "Brand Rep" : "Kit field"}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 text-xs"
                  onClick={() => setMobileConsultFace((f) => (f === "chat" ? "kit" : "chat"))}
                >
                  <ArrowLeftRight className="size-3.5 shrink-0" aria-hidden />
                  {mobileConsultFace === "chat" ? "Edit field" : "Back to chat"}
                </Button>
              </div>
            ) : null}

            {(!showConsultKitPane || splitDesktop || mobileConsultFace === "chat") ? (
              <>
                {!fieldWalkActive ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Fill out the <strong>Brand Center</strong> template on the main page as completely as you can (this walk
                    skips visual and logo mechanics — refine those on the main form). When you are ready, press{" "}
                    <strong>Start Consultation</strong>. The Brand Rep goes through <strong>one field at a time</strong> in
                    Brand OS order. Use <strong>Generate</strong> anytime for a suggested pass, chat to refine, edit the field
                    in the kit pane, then <strong>Submit to Brand Center</strong> to update the live kit, save immediately, and
                    advance. <strong>Skip this question</strong> leaves the current field exactly as when you opened it. Use{" "}
                    <strong>Go to question</strong> to open any field in the walk. <strong>Only consult on blank fields</strong>{" "}
                    skips prefilled fields when you move forward automatically.
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    You are editing a <strong>working draft</strong> (cloned when you started). Chat and the kit pane share
                    it. Scratch notes for “other considerations” live in the kit pane until the final field, when they compile
                    into official copy. Use <strong>Go to question</strong> to jump to any field; use <strong>Field scope</strong>{" "}
                    to limit automatic steps to blank fields only.
                    {showConsultKitPane && !splitDesktop ? (
                      <>
                        {" "}
                        On small screens, use <strong>Edit field</strong> for the editor.
                      </>
                    ) : null}
                  </p>
                )}
                <div className="max-h-[40vh] min-h-[140px] flex-1 space-y-3 overflow-y-auto overscroll-y-contain rounded-xl border border-border bg-muted/20 p-4 text-sm sm:max-h-[48vh] sm:p-5">
                  {consultLines.length === 0 ? (
                    <p className="leading-relaxed text-muted-foreground">
                      {fieldWalkActive ? "Loading this field…" : "Press Start Consultation when your template is ready."}
                    </p>
                  ) : (
                    consultLines.map((l, i) => (
                      <div
                        key={`${i}-${l.role}`}
                        className={
                          l.role === "user"
                            ? "ml-2 rounded-xl bg-primary/10 px-4 py-3 sm:ml-4 sm:px-5 sm:py-3.5"
                            : "mr-2 rounded-xl border border-transparent px-1 py-1 sm:mr-4"
                        }
                      >
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {l.role === "user" ? "You" : "Brand Rep"}
                        </span>
                        <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{l.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {fieldWalkActive && pendingPatch ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    The agent suggested a kit update for this field (shown as a pending patch). It will merge into your
                    working draft when you use <strong>Submit to Brand Center</strong>, or you can keep chatting and editing.
                  </p>
                ) : null}

                {!fieldWalkActive && pendingPatch ? (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm sm:p-5">
                    <p className="font-medium text-foreground">Suggested kit updates</p>
                    <p className="mt-2 leading-relaxed text-muted-foreground">
                      Applies to the Brand Center kit on the page (merge). Use <strong>Apply to Brand Center</strong> or{" "}
                      <strong>Dismiss</strong>.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button type="button" size="default" onClick={applyPendingPatch}>
                        Apply to Brand Center
                      </Button>
                      <Button type="button" size="default" variant="outline" onClick={() => setPendingPatch(null)}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ) : null}

                {fieldWalkActive && fieldWalkEntry && !fieldWalkComplete ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                      disabled={centerPending.isPending || consultSaveBusy}
                      onClick={() => void sendGenerateField()}
                    >
                      {centerPending.isPending ? (
                        <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                      ) : (
                        <Sparkles className="size-4 shrink-0" aria-hidden />
                      )}
                      Generate
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={centerPending.isPending || consultSaveBusy}
                      onClick={() => void skipThisQuestion()}
                    >
                      Skip this question
                    </Button>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <Label htmlFor="brand-rep-consult" className="text-sm">
                    Your reply
                  </Label>
                  <textarea
                    id="brand-rep-consult"
                    className={textareaClass}
                    rows={3}
                    value={consultDraft}
                    onChange={(e) => setConsultDraft(e.target.value)}
                    disabled={
                      centerPending.isPending ||
                      !fieldWalkActive ||
                      fieldWalkComplete ||
                      !fieldWalkEntry ||
                      consultSaveBusy
                    }
                    placeholder={
                      fieldWalkActive && fieldWalkEntry
                        ? "Answer the Brand Rep's latest question…"
                        : "Start Consultation to begin…"
                    }
                  />
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Button
                      type="button"
                      disabled={
                        !consultDraft.trim() ||
                        centerPending.isPending ||
                        !fieldWalkActive ||
                        fieldWalkComplete ||
                        !fieldWalkEntry ||
                        consultSaveBusy
                      }
                      onClick={() => void sendConsult()}
                    >
                      {centerPending.isPending && mainTab === "consult" ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                          Working…
                        </>
                      ) : (
                        "Send"
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}

            {showConsultKitPane && !splitDesktop && mobileConsultFace === "kit" ? (
              <div className="flex min-h-[48vh] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs md:hidden">
                <div className="shrink-0 space-y-2 border-b border-border/60 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Working draft</p>
                  {sectionLabel ? (
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{sectionLabel}</p>
                  ) : null}
                  {fieldWalkEntry ? (
                    <p className="text-sm font-medium text-foreground">
                      Field {fieldWalkIdx + 1} of {CONSULT_FIELD_WALK_ORDER.length}: {fieldWalkEntry.label}
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-foreground">All fields reviewed</p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={consultSaveBusy || !workingProfile}
                    onClick={() => void submitToBrandCenter()}
                  >
                    {consultSaveBusy ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : (
                      "Submit to Brand Center"
                    )}
                  </Button>
                  {fieldWalkActive && fieldWalkEntry && !fieldWalkComplete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={centerPending.isPending || consultSaveBusy}
                      onClick={() => void skipThisQuestion()}
                    >
                      Skip this question
                    </Button>
                  ) : null}
                  {renderConsultScopeSelect(consultScopeIdMobileKit)}
                  {renderConsultJumpNav(jumpNavIdMobileKit)}
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                    {workingProfile && fieldWalkEntry ? (
                      <BrandConsultSingleFieldPane
                        fieldId={fieldWalkEntry.id}
                        profile={workingProfile}
                        setProfile={setWorkingProfileNonNull}
                      />
                    ) : workingProfile && fieldWalkComplete ? (
                      <div className="space-y-3">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          Walk complete — adjust <strong>Other brand considerations</strong> here, then submit.
                        </p>
                        <BrandConsultSingleFieldPane
                          fieldId="otherBrandConsiderations"
                          profile={workingProfile}
                          setProfile={setWorkingProfileNonNull}
                        />
                      </div>
                    ) : null}
                  </div>
                  {fieldWalkActive && fieldWalkEntry && fieldWalkEntry.id !== "otherBrandConsiderations" ? (
                    <ConsultScratchNoteEditor value={consultScratchNote} onChange={setConsultScratchNote} />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {mainTab === "review" ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Primary dialogue here is <strong>only the copy you paste</strong> below. The agent checks it against the{" "}
              <strong>saved</strong> brand kit on the server (save Brand Center first if you have not) — not the unsaved
              form fields on the page.
            </p>
            <textarea
              className={textareaClass}
              value={reviewDraft}
              onChange={(e) => setReviewDraft(e.target.value)}
              placeholder="Copy to review…"
              rows={6}
            />
            <Button
              type="button"
              disabled={!reviewDraft.trim() || reviewMut.isPending}
              onClick={() => {
                setReviewOut("");
                reviewMut.mutate();
              }}
            >
              {reviewMut.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Reviewing…
                </>
              ) : (
                "Review with Brand Rep"
              )}
            </Button>
            {reviewMut.isError ? (
              <p className="text-sm text-destructive">Could not run review. Save your kit and try again.</p>
            ) : null}
            {reviewOut ? (
              <div className="max-h-72 overflow-y-auto overscroll-y-contain rounded-xl border border-border bg-muted/20 p-4 text-sm leading-relaxed whitespace-pre-wrap sm:p-5">
                {reviewOut}
              </div>
            ) : null}
          </div>
        ) : null}

        {centerPending.isError ? (
          <p className="text-sm leading-relaxed text-destructive">Request failed. Check API configuration and try again.</p>
        ) : null}
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}
