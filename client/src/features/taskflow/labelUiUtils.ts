/** Matches project board card label pills: minimal vertical padding, small type. */
export const TASK_LABEL_CHIP_CLASS =
  "max-w-full rounded px-2 py-0.5 text-[10px] font-medium leading-none";

const AUTO_LABEL_PALETTE = [
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#f59e0b",
  "#14b8a6",
  "#ec4899",
  "#64748b",
] as const;

/** Deterministic color from label name; edit colors in main settings. */
export function autoLabelColorFromName(name: string): string {
  const s = name.trim();
  if (!s) return "#6366f1";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AUTO_LABEL_PALETTE[h % AUTO_LABEL_PALETTE.length];
}

/** Lower = better match for sorting (best first). */
export function searchRankLabelName(query: string, name: string): number {
  const q = query.trim().toLowerCase();
  const n = name.toLowerCase();
  if (!q) return 0;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.includes(q)) return 2;
  const d = levenshteinShort(q, n);
  return 3 + d;
}

/** Levenshtein for short user queries vs label names (for “closest” ordering). */
function levenshteinShort(a: string, b: string): number {
  if (a.length > 12 || b.length > 32) {
    return Math.min(10, Math.abs(a.length - b.length) + 4);
  }
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i]![0] = i;
  for (let j = 0; j <= n; j++) d[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
    }
  }
  return d[m]![n]!;
}

export function sortByLabelSearchRelevance<T extends { name: string }>(rows: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return [...rows].sort(
    (a, b) => searchRankLabelName(q, a.name) - searchRankLabelName(q, b.name) || a.name.localeCompare(b.name),
  );
}

/** API label suggestion row (board or user scope). */
export type LabelSuggestionChip = {
  scope: "board" | "user";
  id: string;
  name: string;
  color: string;
  boardId?: string;
};

/**
 * Up to `maxFrequent` picks from `frequent` (API order), then up to `maxRecent` from `recent`,
 * skipping any name that already appeared (case-insensitive). Same name in both lists shows once.
 */
export function mergeFrequentRecentLabelChips(
  frequent: LabelSuggestionChip[],
  recent: LabelSuggestionChip[],
  maxFrequent = 8,
  maxRecent = 8,
): LabelSuggestionChip[] {
  const seenNames = new Set<string>();
  const fromF: LabelSuggestionChip[] = [];
  for (const r of frequent) {
    if (fromF.length >= maxFrequent) break;
    const k = r.name.trim().toLowerCase();
    if (seenNames.has(k)) continue;
    seenNames.add(k);
    fromF.push(r);
  }
  const fromR: LabelSuggestionChip[] = [];
  for (const r of recent) {
    if (fromR.length >= maxRecent) break;
    const k = r.name.trim().toLowerCase();
    if (seenNames.has(k)) continue;
    seenNames.add(k);
    fromR.push(r);
  }
  return [...fromF, ...fromR];
}
