/** Default base title for new top-level notebooks (folders). */
export const DEFAULT_NOTEBOOK_BASE = "Notebook";

/** Default base title for new notes in a folder. */
export const DEFAULT_NOTE_BASE = "Note";

/**
 * Next unused title in the sequence `Base`, `Base 2`, `Base 3`, …
 * Matches whole titles only (same as stored `title` strings).
 */
export function nextSequencedTitle(existingTitles: readonly string[], base: string): string {
  const used = new Set(existingTitles.filter((t) => typeof t === "string" && t.length > 0));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}
