/**
 * Notebook Mail Clerk autotag: parse LLM JSON, validate reuse list, reconcile near-misses, merge to client suggestion rows.
 */

export type NotebookAutotagVocabularyItem = {
  kind: "board" | "user";
  id: string;
  name: string;
  color: string;
  /** Preformatted line for the prompt, e.g. "- Bug (board, 12 tickets, 3 notes)" */
  lineForPrompt: string;
};

export type NotebookAutotagSuggestionRow = {
  name: string;
  match: { kind: "board" | "user"; id: string; color: string } | null;
};

const MAX_THEMES = 7;
const MAX_REUSE = 6;
const MAX_PROPOSE = 4;

export function sanitizeNotebookAutotagLabelName(raw: string): string {
  const s = raw
    .replace(/^#/, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-_. ]+/g, "")
    .replace(/^[\s._-]+|[\s._-]+$/g, "")
    .slice(0, 48);
  return s;
}

function levenshteinShort(a: string, b: string): number {
  if (a.length > 14 || b.length > 24) {
    return Math.min(99, Math.abs(a.length - b.length) + 5);
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

/** If exactly one strong near-match exists, return it; otherwise null (conservative). */
export function reconcileProposeToVocabulary(
  proposeSanitized: string,
  vocabulary: NotebookAutotagVocabularyItem[],
): NotebookAutotagVocabularyItem | null {
  const p = proposeSanitized.trim().toLowerCase();
  if (p.length < 2) return null;

  const candidates: { v: NotebookAutotagVocabularyItem; score: number }[] = [];

  for (const v of vocabulary) {
    const n = v.name.trim().toLowerCase();
    if (!n) continue;

    if (p === n) {
      candidates.push({ v, score: 0 });
      continue;
    }

    if (p.length >= 3 && n.length >= 3) {
      if (n.includes(p) || p.includes(n)) {
        const shorter = Math.min(p.length, n.length);
        const longer = Math.max(p.length, n.length);
        if (shorter >= 3 && longer / shorter <= 2.2) {
          candidates.push({ v, score: 1 });
          continue;
        }
      }
    }

    if (p.length >= 3 && n.length >= 3 && p.length <= 18 && n.length <= 18) {
      const d = levenshteinShort(p, n);
      if (d <= 1) {
        candidates.push({ v, score: 2 + d });
        continue;
      }
    }
  }

  if (candidates.length !== 1) return null;
  return candidates[0]!.v;
}

function stringArrayField(o: Record<string, unknown>, keys: string[]): string[] {
  for (const k of keys) {
    const v = o[k];
    if (!Array.isArray(v)) continue;
    const out: string[] = [];
    for (const item of v) {
      if (typeof item === "string") {
        const t = item.replace(/^#/, "").trim();
        if (t) out.push(t);
      }
    }
    return out;
  }
  return [];
}

/** Parse model JSON; tolerates legacy `labels` / `tags` only as weak fallback. */
export function parseNotebookAutotagModelJson(raw: string): {
  themes: string[];
  reuseExisting: string[];
  proposeNew: string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { themes: [], reuseExisting: [], proposeNew: [] };
  }
  if (!parsed || typeof parsed !== "object") {
    return { themes: [], reuseExisting: [], proposeNew: [] };
  }
  const o = parsed as Record<string, unknown>;

  let themes = stringArrayField(o, ["themes", "keyThemes", "key_themes"]);
  let reuseExisting = stringArrayField(o, ["reuseExisting", "reuse_existing", "existing", "reuse"]);
  let proposeNew = stringArrayField(o, ["proposeNew", "propose_new", "newLabels", "new_labels", "create"]);

  if (reuseExisting.length === 0 && proposeNew.length === 0) {
    const legacy = stringArrayField(o, ["labels", "tags"]);
    for (const x of legacy) {
      proposeNew.push(x);
    }
  }

  themes = [...new Set(themes.map((t) => t.slice(0, 120)))].slice(0, MAX_THEMES);
  reuseExisting = [...new Set(reuseExisting)].slice(0, MAX_REUSE);
  proposeNew = [...new Set(proposeNew)].slice(0, MAX_PROPOSE);

  return { themes, reuseExisting, proposeNew };
}

function vocabByLower(vocabulary: NotebookAutotagVocabularyItem[]): Map<string, NotebookAutotagVocabularyItem> {
  const m = new Map<string, NotebookAutotagVocabularyItem>();
  for (const v of vocabulary) {
    const k = v.name.trim().toLowerCase();
    if (!k) continue;
    if (!m.has(k)) m.set(k, v);
  }
  return m;
}

/**
 * Turn validated reuse + propose strings into API suggestion rows (deduped by name).
 */
export function buildNotebookAutotagSuggestions(
  vocabulary: NotebookAutotagVocabularyItem[],
  reuseExisting: string[],
  proposeNew: string[],
): NotebookAutotagSuggestionRow[] {
  const map = vocabByLower(vocabulary);
  const rows: NotebookAutotagSuggestionRow[] = [];
  const seen = new Set<string>();

  const pushRow = (name: string, match: NotebookAutotagSuggestionRow["match"]) => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    rows.push({ name: name.trim(), match });
  };

  for (const raw of reuseExisting) {
    const v = map.get(raw.trim().toLowerCase());
    if (v) {
      pushRow(v.name, { kind: v.kind, id: v.id, color: v.color });
    }
  }

  const reuseLower = new Set(reuseExisting.map((s) => s.trim().toLowerCase()).filter(Boolean));

  for (const raw of proposeNew) {
    const cleaned = sanitizeNotebookAutotagLabelName(raw);
    if (!cleaned) continue;
    if (reuseLower.has(cleaned.toLowerCase())) continue;

    const direct = map.get(cleaned.toLowerCase());
    if (direct) {
      pushRow(direct.name, { kind: direct.kind, id: direct.id, color: direct.color });
      continue;
    }

    const promoted = reconcileProposeToVocabulary(cleaned, vocabulary);
    if (promoted) {
      pushRow(promoted.name, { kind: promoted.kind, id: promoted.id, color: promoted.color });
      continue;
    }

    pushRow(cleaned, null);
  }

  return rows;
}
