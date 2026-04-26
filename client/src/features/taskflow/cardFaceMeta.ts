export const CARD_FACE_META_KEYS = [
  "showLabels",
  "showDueDate",
  "showAssignee",
  "showPriority",
  "showTicketNumber",
] as const;

export type CardFaceMetaKey = (typeof CARD_FACE_META_KEYS)[number];

export type CardFaceMeta = Record<CardFaceMetaKey, boolean>;

export const DEFAULT_CARD_FACE_META: CardFaceMeta = {
  showLabels: true,
  showDueDate: true,
  showAssignee: true,
  showPriority: true,
  showTicketNumber: true,
};

export const CARD_FACE_META_LABELS: Record<CardFaceMetaKey, string> = {
  showLabels: "Labels",
  showDueDate: "Due date",
  showAssignee: "Assigned to",
  showPriority: "Priority",
  showTicketNumber: "Ticket number",
};

function parsePatch(raw: unknown): Partial<CardFaceMeta> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<CardFaceMeta> = {};
  for (const k of CARD_FACE_META_KEYS) {
    if (typeof o[k] === "boolean") out[k] = o[k] as boolean;
  }
  return out;
}

/** Merge board-level JSON defaults with optional per-sub-board overrides. */
export function resolveCardFaceMeta(boardJson: unknown, subJson: unknown | null | undefined): CardFaceMeta {
  const b = parsePatch(boardJson);
  const s = subJson === null || subJson === undefined ? {} : parsePatch(subJson);
  return { ...DEFAULT_CARD_FACE_META, ...b, ...s };
}

export function normalizeCardFaceMetaInput(raw: unknown): CardFaceMeta {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_CARD_FACE_META };
  return { ...DEFAULT_CARD_FACE_META, ...parsePatch(raw) };
}
