import type { ConsultSectionId } from "@/features/agents/brandConsultSections";
import type { BrandProfile } from "@/features/brand/types";

/**
 * Ordered walk for Brand Rep field-by-field consultation (blank-by-blank).
 * User is expected to pre-fill the Brand Center template first; the agent then addresses each field in order.
 */
export const CONSULT_FIELD_WALK_ORDER = [
  { id: "identity.displayName", sectionId: "discovery", label: "Display / brand name" },
  { id: "identity.industry", sectionId: "discovery", label: "Industry / category" },
  { id: "audience.summary", sectionId: "discovery", label: "Ideal customer / audience summary" },
  { id: "identity.legalName", sectionId: "identity_structure", label: "Legal entity name" },
  { id: "identity.tagline", sectionId: "identity_structure", label: "Tagline" },
  { id: "purpose.mission", sectionId: "purpose_mission", label: "Mission" },
  { id: "purpose.vision", sectionId: "purpose_mission", label: "Vision" },
  { id: "values", sectionId: "purpose_mission", label: "Values" },
  { id: "audience.segments", sectionId: "audience_positioning", label: "Segments or personas" },
  { id: "audience.geography", sectionId: "audience_positioning", label: "Geography / markets" },
  { id: "positioning.category", sectionId: "audience_positioning", label: "Market category" },
  { id: "positioning.differentiators", sectionId: "audience_positioning", label: "Differentiators" },
  { id: "positioning.competitors", sectionId: "audience_positioning", label: "Competitive landscape" },
  { id: "voice.personality", sectionId: "voice_comms", label: "Voice — personality" },
  { id: "voice.dos", sectionId: "voice_comms", label: "Voice — do" },
  { id: "voice.donts", sectionId: "voice_comms", label: "Voice — don't" },
  { id: "voice.vocabulary", sectionId: "voice_comms", label: "Vocabulary & phrases" },
  { id: "messaging.keyMessages", sectionId: "messaging_narrative", label: "Key messages / pillars" },
  { id: "messaging.proofPoints", sectionId: "messaging_narrative", label: "Proof points" },
  { id: "story.origin", sectionId: "messaging_narrative", label: "Origin / narrative" },
  { id: "story.socialProof", sectionId: "messaging_narrative", label: "Social proof" },
  { id: "goals.business", sectionId: "goals_and_metrics", label: "Business goals" },
  { id: "goals.marketing", sectionId: "goals_and_metrics", label: "Marketing / brand goals" },
  { id: "goals.metrics", sectionId: "goals_and_metrics", label: "Success metrics" },
  { id: "channels", sectionId: "gtm_cx", label: "Channels & touchpoints" },
  { id: "legal.trademark", sectionId: "governance_risk_legal", label: "Trademark / usage notes" },
  { id: "legal.disclaimers", sectionId: "governance_risk_legal", label: "Disclaimers" },
  {
    id: "otherBrandConsiderations",
    sectionId: "other_considerations",
    label: "Other brand considerations (catch-all)",
  },
] as const satisfies ReadonlyArray<{ id: string; sectionId: ConsultSectionId; label: string }>;

export type ConsultFieldWalkEntry = (typeof CONSULT_FIELD_WALK_ORDER)[number];
export type ConsultFieldId = ConsultFieldWalkEntry["id"];

export function getConsultFieldValue(profile: BrandProfile, fieldId: string): string {
  if (fieldId === "values") {
    return (profile.values ?? []).join("\n");
  }
  if (fieldId === "channels") {
    return typeof profile.channels === "string" ? profile.channels : "";
  }
  if (fieldId === "otherBrandConsiderations") {
    return profile.otherBrandConsiderations ?? "";
  }
  const [top, ...rest] = fieldId.split(".");
  if (!top) return "";
  const key = rest.join(".");
  const block = profile[top as keyof BrandProfile];
  if (!block || typeof block !== "object" || Array.isArray(block)) return "";
  const v = (block as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

export function consultFieldIsFilled(profile: BrandProfile, fieldId: string): boolean {
  return getConsultFieldValue(profile, fieldId).trim().length > 0;
}

/** First walk index whose field is empty in `profile`, or null if every walk field has text. */
export function findFirstConsultWalkBlankIndex(profile: BrandProfile): number | null {
  for (let i = 0; i < CONSULT_FIELD_WALK_ORDER.length; i++) {
    if (!consultFieldIsFilled(profile, CONSULT_FIELD_WALK_ORDER[i].id)) return i;
  }
  return null;
}

/** First walk index strictly after `afterIdx` whose field is empty, or null if none. */
export function findNextConsultWalkBlankIndex(profile: BrandProfile, afterIdx: number): number | null {
  for (let i = afterIdx + 1; i < CONSULT_FIELD_WALK_ORDER.length; i++) {
    if (!consultFieldIsFilled(profile, CONSULT_FIELD_WALK_ORDER[i].id)) return i;
  }
  return null;
}

/**
 * Next field index after `fromIdx` when advancing the walk.
 * With `blankOnly`, skips prefilled fields; returns `CONSULT_FIELD_WALK_ORDER.length` when no further blank fields exist after `fromIdx`.
 */
export function getNextConsultWalkFieldIndex(
  profile: BrandProfile,
  fromIdx: number,
  blankOnly: boolean,
): number {
  const len = CONSULT_FIELD_WALK_ORDER.length;
  if (!blankOnly) {
    return Math.min(fromIdx + 1, len);
  }
  const nextBlank = findNextConsultWalkBlankIndex(profile, fromIdx);
  return nextBlank ?? len;
}

/** Set a single walk field value on a draft (same paths as `BrandConsultSingleFieldPane`). */
export function setConsultFieldValue(profile: BrandProfile, fieldId: string, value: string): BrandProfile {
  if (fieldId === "values") {
    return {
      ...profile,
      values: value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }
  if (fieldId === "channels") {
    return { ...profile, channels: value };
  }
  if (fieldId === "otherBrandConsiderations") {
    return { ...profile, otherBrandConsiderations: value };
  }
  const dot = fieldId.indexOf(".");
  if (dot === -1) return profile;
  const top = fieldId.slice(0, dot) as keyof BrandProfile;
  const key = fieldId.slice(dot + 1);
  const prev = profile[top];
  const block =
    prev && typeof prev === "object" && !Array.isArray(prev) ? { ...(prev as Record<string, unknown>) } : {};
  block[key] = value;
  return { ...profile, [top]: block };
}

export function consultFieldEntry(fieldId: string): ConsultFieldWalkEntry | undefined {
  return CONSULT_FIELD_WALK_ORDER.find((f) => f.id === fieldId);
}
