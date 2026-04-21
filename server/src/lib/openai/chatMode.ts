export const CONSULTING_MODES = ["strategy", "financial", "operations", "technical"] as const;
export type ConsultingMode = (typeof CONSULTING_MODES)[number];

export function parseConsultingMode(input: unknown): ConsultingMode | null {
  if (typeof input !== "string") {
    return null;
  }
  if ((CONSULTING_MODES as readonly string[]).includes(input)) {
    return input as ConsultingMode;
  }
  return null;
}

export function defaultConsultingMode(): ConsultingMode {
  return "strategy";
}
