import { useMutation } from "@tanstack/react-query";
import { Goal, GripVertical, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  postBrandRepCenter,
  postBrandRepReview,
  type BrandRepCenterPayload,
} from "@/features/agents/api";
import { mergeBrandProfilePatch } from "@/features/brand/mergeBrandProfilePatch";
import type { BrandProfile } from "@/features/brand/types";
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

const SHEET_WIDTH_STORAGE_KEY = "brandRepAgentSheetWidthPx";
const SHEET_WIDTH_DEFAULT = 640;
const SHEET_WIDTH_MIN = 380;
const SHEET_WIDTH_MAX = 1200;

const textareaClass =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full min-h-[100px] resize-y rounded-lg border bg-transparent px-4 py-3 text-sm leading-relaxed shadow-xs outline-none focus-visible:ring-[3px]";

const CONSULT_SECTIONS = [
  { id: "discovery", label: "Discovery" },
  { id: "core_identity", label: "Core identity" },
  { id: "purpose", label: "Purpose & values" },
  { id: "audience_positioning", label: "Audience & positioning" },
  { id: "voice_tone", label: "Voice & tone" },
  { id: "visual_system", label: "Visual system" },
  { id: "goals_outcomes", label: "Goals & outcomes" },
  { id: "messaging_proof", label: "Messaging & proof" },
  { id: "channels_legal", label: "Channels & legal" },
  { id: "assets_logos", label: "Logos & imagery" },
  { id: "other_considerations", label: "Other brand considerations" },
  { id: "recap", label: "Recap" },
] as const;

type ConsultSectionId = (typeof CONSULT_SECTIONS)[number]["id"];

type ChatLine = { role: "user" | "assistant"; text: string };

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
};

export function BrandRepAgentSheet({ workspaceId, brandProfile, onApplyProfilePatch }: BrandRepAgentSheetProps) {
  const [open, setOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(SHEET_WIDTH_DEFAULT);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  const panelWidthPx = useMemo(() => {
    const w = Number.isFinite(panelWidth) && panelWidth > 0 ? panelWidth : SHEET_WIDTH_DEFAULT;
    return Math.min(SHEET_WIDTH_MAX, Math.max(SHEET_WIDTH_MIN, w));
  }, [panelWidth]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHEET_WIDTH_STORAGE_KEY);
      const n = raw ? Number.parseInt(raw, 10) : NaN;
      if (Number.isFinite(n) && n >= SHEET_WIDTH_MIN && n <= SHEET_WIDTH_MAX) {
        setPanelWidth(n);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidthRef.current;
    const onMove = (ev: MouseEvent) => {
      const dx = startX - ev.clientX;
      const cap = Math.min(SHEET_WIDTH_MAX, typeof window !== "undefined" ? window.innerWidth - 24 : SHEET_WIDTH_MAX);
      const next = Math.min(cap, Math.max(SHEET_WIDTH_MIN, startW + dx));
      panelWidthRef.current = next;
      setPanelWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      try {
        localStorage.setItem(SHEET_WIDTH_STORAGE_KEY, String(panelWidthRef.current));
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
  const [consultSectionIdx, setConsultSectionIdx] = useState(0);
  const [askDraft, setAskDraft] = useState("");
  const [consultDraft, setConsultDraft] = useState("");
  const [reviewDraft, setReviewDraft] = useState("");
  const [reviewOut, setReviewOut] = useState("");
  const [pendingPatch, setPendingPatch] = useState<Record<string, unknown> | null>(null);

  const consultSection = CONSULT_SECTIONS[consultSectionIdx]!;

  const callBrandRepCenter = useCallback(
    async (args: {
      mode: "ask" | "consult";
      userMessage: string;
      transcriptLines: ChatLine[];
      consultSectionId: ConsultSectionId;
    }): Promise<BrandRepCenterPayload> => {
      const res = await postBrandRepCenter({
        workspaceId: workspaceId!,
        message: args.userMessage,
        mode: args.mode,
        consultSectionId: args.consultSectionId,
        transcript: formatTranscript(args.transcriptLines),
        brandProfileDraft: brandProfile,
      });
      const payload = res.brandRepCenter;
      if (!payload) throw new Error("Missing brandRepCenter payload");
      return payload;
    },
    [brandProfile, workspaceId],
  );

  const centerPending = useMutation({
    mutationFn: callBrandRepCenter,
  });

  const reviewMut = useMutation({
    mutationFn: () => postBrandRepReview({ workspaceId: workspaceId!, message: reviewDraft }),
    onSuccess: (d) => setReviewOut(d.result),
  });

  const applyPendingPatch = useCallback(() => {
    if (!pendingPatch) return;
    onApplyProfilePatch(mergeBrandProfilePatch(brandProfile, pendingPatch));
    setPendingPatch(null);
  }, [brandProfile, onApplyProfilePatch, pendingPatch]);

  const startConsultation = useCallback(async () => {
    if (!workspaceId) return;
    setPendingPatch(null);
    setConsultLines([]);
    setConsultSectionIdx(0);
    setConsultDraft("");
    try {
      const payload = await centerPending.mutateAsync({
        mode: "consult",
        userMessage: "__START__",
        transcriptLines: [],
        consultSectionId: "discovery",
      });
      setConsultLines([{ role: "assistant", text: payload.assistantMessage }]);
      if (payload.proposedProfilePatch && Object.keys(payload.proposedProfilePatch).length > 0) {
        setPendingPatch(payload.proposedProfilePatch);
      }
    } catch {
      setConsultLines([]);
    }
  }, [centerPending, workspaceId]);

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
    setConsultDraft("");
    const userLine: ChatLine = { role: "user", text: t };
    setConsultLines((prev) => [...prev, userLine]);
    setPendingPatch(null);
    try {
      const payload = await centerPending.mutateAsync({
        mode: "consult",
        userMessage: t,
        transcriptLines: consultLines,
        consultSectionId: consultSection.id as ConsultSectionId,
      });
      setConsultLines((prev) => [...prev, { role: "assistant", text: payload.assistantMessage }]);
      if (payload.proposedProfilePatch && Object.keys(payload.proposedProfilePatch).length > 0) {
        setPendingPatch(payload.proposedProfilePatch);
      }
    } catch {
      setConsultLines((prev) => prev.slice(0, -1));
    }
  }, [consultDraft, consultLines, centerPending, consultSection.id, workspaceId]);

  const goNextConsultSection = useCallback(async () => {
    if (!workspaceId || consultSectionIdx >= CONSULT_SECTIONS.length - 1) return;
    const prevIdx = consultSectionIdx;
    const nextIdx = consultSectionIdx + 1;
    const nextSection = CONSULT_SECTIONS[nextIdx]!;
    const priorTranscript = consultLines;
    setConsultSectionIdx(nextIdx);
    setPendingPatch(null);
    const bridge: ChatLine = {
      role: "user",
      text: `Let's move on to the next part of the brand kit: **${nextSection.label}**. Open this section with what you need from me.`,
    };
    setConsultLines((prev) => [...prev, bridge]);
    try {
      const payload = await centerPending.mutateAsync({
        mode: "consult",
        userMessage: bridge.text,
        transcriptLines: priorTranscript,
        consultSectionId: nextSection.id as ConsultSectionId,
      });
      setConsultLines((prev) => [...prev, { role: "assistant", text: payload.assistantMessage }]);
      if (payload.proposedProfilePatch && Object.keys(payload.proposedProfilePatch).length > 0) {
        setPendingPatch(payload.proposedProfilePatch);
      }
    } catch {
      setConsultLines((prev) => prev.slice(0, -1));
      setConsultSectionIdx(prevIdx);
    }
  }, [centerPending, consultLines, consultSectionIdx, workspaceId]);

  const resetConsultation = useCallback(() => {
    setConsultLines([]);
    setConsultDraft("");
    setConsultSectionIdx(0);
    setPendingPatch(null);
  }, []);

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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Goal className="size-4" aria-hidden />
          Brand Rep Agent
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-full max-w-none flex-col gap-0 overflow-y-auto border-l p-0 shadow-xl !max-w-none"
        style={{
          width: `min(${panelWidthPx}px, calc(100vw - 12px))`,
        }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize panel"
          title="Drag to resize"
          className="absolute top-0 bottom-0 left-0 z-[60] flex w-4 cursor-col-resize touch-none items-center justify-center border-r border-transparent hover:border-border hover:bg-muted/50 active:bg-muted"
          onMouseDown={startResize}
        >
          <GripVertical className="size-4 text-muted-foreground opacity-70" aria-hidden />
        </div>

        <SheetHeader className="gap-2 border-b border-border/60 px-6 pb-5 pl-10 pr-7 pt-6 sm:px-8 sm:pb-6 sm:pl-12 sm:pr-10 sm:pt-7">
          <SheetTitle className="text-lg">Brand Rep Agent</SheetTitle>
          <SheetDescription className="text-sm leading-relaxed">
            Brand strategy, positioning, voice, and kit building. The agent treats the <strong>Brand Center form</strong>{" "}
            (all kit fields on this page, including your unsaved edits) as the primary workspace dialogue, plus what you
            type in the chat here.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-6 pb-8 pl-10 pr-7 sm:gap-7 sm:px-8 sm:pb-10 sm:pl-12 sm:pr-10">
        <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-foreground">
          <span className="font-medium">Primary dialogue</span>{" "}
          <span className="text-muted-foreground">
            — every section of your brand kit on this page (identity through other considerations). Consultation and
            suggestions apply there; Review copy uses only what you paste against the <em>saved</em> kit on the server.
          </span>
        </div>
        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/30 p-1.5">
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
                Section {consultSectionIdx + 1} of {CONSULT_SECTIONS.length}:{" "}
                <span className="font-medium text-foreground">{consultSection.label}</span>
              </span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0 text-xs" onClick={resetConsultation}>
                  Reset
                </Button>
                {consultLines.length === 0 ? (
                  <Button type="button" size="sm" className="h-9 shrink-0 text-xs" onClick={() => void startConsultation()}>
                    Start consultation
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The agent walks the kit with you: questions and patches refer to the Brand Center fields on this page (your
              live draft). You can edit everything afterward and save when ready.
            </p>
            <div className="max-h-[40vh] min-h-[140px] flex-1 space-y-3 overflow-y-auto overscroll-y-contain rounded-xl border border-border bg-muted/20 p-4 text-sm sm:max-h-[48vh] sm:p-5">
              {consultLines.length === 0 ? (
                <p className="leading-relaxed text-muted-foreground">
                  Start the automated walkthrough — it opens with a broad question so you can explain the brand in your
                  own words.
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

            {pendingPatch ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm sm:p-5">
                <p className="font-medium text-foreground">Suggested kit updates</p>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  Applies to the form on the left (merge). Review and save the kit when you are satisfied.
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
                disabled={centerPending.isPending || consultLines.length === 0}
                placeholder="Answer the Brand Rep's latest question…"
              />
              <div className="flex flex-wrap gap-3 pt-1">
                <Button
                  type="button"
                  disabled={!consultDraft.trim() || centerPending.isPending || consultLines.length === 0}
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
                <Button
                  type="button"
                  variant="secondary"
                  disabled={consultLines.length === 0 || centerPending.isPending || consultSectionIdx >= CONSULT_SECTIONS.length - 1}
                  onClick={() => void goNextConsultSection()}
                >
                  Next section
                </Button>
              </div>
            </div>
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
  );
}
