/** Matches `RapidRouterPage` Brand Center persistence. */
export const BRAND_CENTER_STORAGE_KEY = "atlas.rapidRouter.brandCenter.v1";

/**
 * Loads recent Brand Center captures from localStorage and formats them for AI context.
 * Safe to call outside Rapid Router (returns empty string if missing).
 */
export function getBrandCenterContextForQuickCapture(maxEntries = 14, maxChars = 8000): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(BRAND_CENTER_STORAGE_KEY);
    if (!raw) return "";
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return "";
    const lines: string[] = [];
    let len = 0;
    for (const item of arr.slice(0, maxEntries)) {
      if (!item || typeof item !== "object") continue;
      const t = typeof (item as { text?: string }).text === "string" ? (item as { text: string }).text : "";
      const line = t.trim();
      if (!line) continue;
      const block = `• ${line}`;
      if (len + block.length > maxChars) break;
      lines.push(block);
      len += block.length + 1;
    }
    return lines.join("\n");
  } catch {
    return "";
  }
}
