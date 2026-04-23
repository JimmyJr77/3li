import type { MailroomPlanPayload } from "@/features/agents/api";
import type { MailClerkActionRow } from "@/features/rapidRouter/mailClerkActionRows";
import type { MailPlanChunkRoute } from "@/features/rapidRouter/mailPlanChunkRouting";

export type RapidRouterManualDestination = "brandCenter" | "notes" | "brainstorm" | "boards";

export type RapidRouterDraftV1 = {
  v: 1;
  captureText: string;
  mailInstruction: string;
  /** Mail Clerk step 1 summary (optional). */
  mailDecomposeSummary: string | null;
  /** Editable action rows between decomposition and routing. */
  mailActionRows: MailClerkActionRow[] | null;
  mailPlan: MailroomPlanPayload | null;
  chunkRoutes: MailPlanChunkRoute[];
  destination: RapidRouterManualDestination;
  notesFolderId: string | null;
  boardsBoardId: string | null;
  boardsListId: string | null;
  brainstormSessionId: string | null;
  mailClerkRoutingOpen: boolean;
  manualRoutingPanelOpen: boolean;
  holdingPenOpen: boolean;
};

export function rapidRouterDraftKey(workspaceId: string): string {
  return `atlas.rapidRouter.draft.ws.${workspaceId}`;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

export function loadRapidRouterDraft(workspaceId: string): RapidRouterDraftV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(rapidRouterDraftKey(workspaceId));
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!isRecord(o) || o.v !== 1) return null;
    const captureText = typeof o.captureText === "string" ? o.captureText : "";
    const mailInstruction = typeof o.mailInstruction === "string" ? o.mailInstruction : "";
    const mailPlan = (o.mailPlan ?? null) as MailroomPlanPayload | null;
    const chunkRoutes = Array.isArray(o.chunkRoutes) ? (o.chunkRoutes as MailPlanChunkRoute[]) : [];
    const mailDecomposeSummary =
      typeof o.mailDecomposeSummary === "string" ? o.mailDecomposeSummary : null;
    let mailActionRows: MailClerkActionRow[] | null = null;
    if (Array.isArray(o.mailActionRows)) {
      const rows: MailClerkActionRow[] = [];
      for (const r of o.mailActionRows) {
        if (!r || typeof r !== "object") continue;
        const row = r as Record<string, unknown>;
        const id = typeof row.id === "string" ? row.id : crypto.randomUUID();
        const summary = typeof row.summary === "string" ? row.summary : "";
        const detail = typeof row.detail === "string" ? row.detail : "";
        const selected = typeof row.selected === "boolean" ? row.selected : true;
        rows.push({ id, summary, detail, selected });
      }
      mailActionRows = rows.length ? rows : null;
    }
    const dest = o.destination;
    const destination: RapidRouterManualDestination =
      dest === "notes" || dest === "brainstorm" || dest === "boards" || dest === "brandCenter"
        ? dest
        : "boards";
    return {
      v: 1,
      captureText,
      mailInstruction,
      mailDecomposeSummary,
      mailActionRows,
      mailPlan,
      chunkRoutes,
      destination,
      notesFolderId: typeof o.notesFolderId === "string" ? o.notesFolderId : null,
      boardsBoardId: typeof o.boardsBoardId === "string" ? o.boardsBoardId : null,
      boardsListId: typeof o.boardsListId === "string" ? o.boardsListId : null,
      brainstormSessionId: typeof o.brainstormSessionId === "string" ? o.brainstormSessionId : null,
      mailClerkRoutingOpen: Boolean(o.mailClerkRoutingOpen),
      manualRoutingPanelOpen: Boolean(o.manualRoutingPanelOpen),
      holdingPenOpen: Boolean(o.holdingPenOpen),
    };
  } catch {
    return null;
  }
}

export function saveRapidRouterDraft(workspaceId: string, draft: RapidRouterDraftV1): void {
  try {
    localStorage.setItem(rapidRouterDraftKey(workspaceId), JSON.stringify(draft));
  } catch {
    /* quota */
  }
}
