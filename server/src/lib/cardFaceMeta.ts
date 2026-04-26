/** Keys for “title + meta” on standard ticket cards (kanban). */
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

function isBool(v: unknown): v is boolean {
  return typeof v === "boolean";
}

/** Picks known boolean keys from JSON; missing keys are omitted (inherit in merge). */
export function parseCardFaceMetaPatch(raw: unknown): Partial<CardFaceMeta> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<CardFaceMeta> = {};
  for (const k of CARD_FACE_META_KEYS) {
    if (isBool(o[k])) out[k] = o[k];
  }
  return out;
}

export function resolveCardFaceMeta(boardJson: unknown, subJson: unknown | null | undefined): CardFaceMeta {
  const b = parseCardFaceMetaPatch(boardJson);
  const s =
    subJson === null || subJson === undefined ? {} : parseCardFaceMetaPatch(subJson);
  return { ...DEFAULT_CARD_FACE_META, ...b, ...s };
}

/** Coerce API / JSON body to a full meta object (unknown keys ignored). */
export function normalizeCardFaceMetaInput(raw: unknown): CardFaceMeta {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_CARD_FACE_META };
  return { ...DEFAULT_CARD_FACE_META, ...parseCardFaceMetaPatch(raw) };
}
