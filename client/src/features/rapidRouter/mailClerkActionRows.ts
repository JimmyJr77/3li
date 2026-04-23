import type { MailroomActionItemDecomp } from "@/features/agents/api";

export type MailClerkActionRow = {
  id: string;
  summary: string;
  detail: string;
  selected: boolean;
};

export function actionRowsFromDecomposition(items: MailroomActionItemDecomp[]): MailClerkActionRow[] {
  return items.map((it) => ({
    id: crypto.randomUUID(),
    summary: it.summary,
    detail: it.detail,
    selected: true,
  }));
}

export function selectedActionItemsForRoute(rows: MailClerkActionRow[]): MailroomActionItemDecomp[] {
  return rows
    .filter((r) => r.selected && (r.summary.trim() || r.detail.trim()))
    .map((r) => ({
      summary: r.summary.trim() || "Untitled action",
      detail: r.detail.trim(),
    }));
}
