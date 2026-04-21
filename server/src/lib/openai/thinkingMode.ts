export type ThinkingMode = "divergent" | "convergent" | "strategic" | "execution";

export function parseThinkingMode(raw: unknown): ThinkingMode | null {
  if (typeof raw !== "string") {
    return null;
  }
  if (
    raw === "divergent" ||
    raw === "convergent" ||
    raw === "strategic" ||
    raw === "execution"
  ) {
    return raw;
  }
  return null;
}
