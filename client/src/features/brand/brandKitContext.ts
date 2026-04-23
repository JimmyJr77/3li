import { fetchBrandKitAiText } from "./api";

/** Legacy global key (pre–per-workspace); not written anymore. */
export const RAPID_ROUTER_BRAND_STORAGE_KEY = "atlas.rapidRouter.brandCenter.v1";

/** @deprecated Use RAPID_ROUTER_BRAND_STORAGE_KEY */
export const BRAND_CENTER_STORAGE_KEY = RAPID_ROUTER_BRAND_STORAGE_KEY;

/** Device-local Rapid Router “Brand Center” inbox, one array per brand workspace. */
export function rapidRouterBrandStorageKey(workspaceId: string): string {
  return `atlas.rapidRouter.brandCenter.ws.${workspaceId}`;
}

export type RapidBrandEntry = { id: string; text: string; createdAt: string };

/**
 * Recent Rapid Router “Brand Center” destination captures — device-local supplements
 * merged with the saved workspace kit for AI. Scoped per `workspaceId` (brand).
 */
export function getRapidRouterBrandSnippets(
  maxEntries = 14,
  maxChars = 8000,
  workspaceId?: string | null,
): string {
  if (typeof window === "undefined" || !workspaceId) return "";
  try {
    const raw = localStorage.getItem(rapidRouterBrandStorageKey(workspaceId));
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

export function loadRapidRouterBrandEntries(workspaceId: string | null | undefined): RapidBrandEntry[] {
  if (typeof window === "undefined" || !workspaceId) return [];
  try {
    const raw = localStorage.getItem(rapidRouterBrandStorageKey(workspaceId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: RapidBrandEntry[] = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      const text = typeof o.text === "string" ? o.text : "";
      const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
      if (id && text) out.push({ id, text, createdAt });
    }
    return out;
  } catch {
    return [];
  }
}

export function removeRapidRouterBrandEntry(id: string, workspaceId: string | null | undefined): void {
  if (!workspaceId) return;
  try {
    const entries = loadRapidRouterBrandEntries(workspaceId).filter((e) => e.id !== id);
    localStorage.setItem(rapidRouterBrandStorageKey(workspaceId), JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

/** Append a capture from Rapid Router’s “Brand Center” destination (same storage as inbox). */
export function appendRapidRouterBrandCapture(text: string, workspaceId: string): RapidBrandEntry | null {
  try {
    const key = rapidRouterBrandStorageKey(workspaceId);
    const prevRaw = localStorage.getItem(key);
    const prev = prevRaw ? (JSON.parse(prevRaw) as unknown) : [];
    const arr = Array.isArray(prev) ? prev : [];
    const entry: RapidBrandEntry = { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify([entry, ...arr]));
    return entry;
  } catch {
    return null;
  }
}

function mergeAndTruncate(kit: string, rapid: string, maxChars: number): string {
  const k = kit.trim();
  const r = rapid.trim();
  const sep = "\n\n---\n\n";
  if (!k) return r.length > maxChars ? `${r.slice(0, maxChars)}\n…(truncated)` : r;
  if (!r) return k.length > maxChars ? `${k.slice(0, maxChars)}\n…(truncated)` : k;
  const combined = `${k}${sep}Rapid Router quick captures (this device):\n${r}`;
  if (combined.length <= maxChars) return combined;
  if (k.length >= maxChars) return `${k.slice(0, maxChars)}\n…(truncated)`;
  const budget = maxChars - k.length - sep.length - "Rapid Router quick captures (this device):\n".length;
  if (budget <= 0) return `${k.slice(0, maxChars)}\n…(truncated)`;
  return `${k}${sep}Rapid Router quick captures (this device):\n${r.slice(0, budget)}${r.length > budget ? "\n…(truncated)" : ""}`;
}

/**
 * Fetches authoritative formatted kit from the API and appends Rapid Router snippets.
 * Use for Notes refine and anywhere a single merged brand string is needed on the client.
 */
export async function getBrandContextForAI(
  workspaceId: string | null | undefined,
  maxChars = 12_000,
): Promise<string> {
  let kit = "";
  if (workspaceId) {
    try {
      kit = (await fetchBrandKitAiText(workspaceId)).trim();
    } catch {
      /* network / 404 */
    }
  }
  const rapid = getRapidRouterBrandSnippets(14, Math.min(6000, Math.floor(maxChars * 0.5)), workspaceId);
  return mergeAndTruncate(kit, rapid, maxChars);
}

/** @deprecated Use getRapidRouterBrandSnippets */
export function getBrandCenterContextForQuickCapture(
  maxEntries = 14,
  maxChars = 8000,
  workspaceId?: string | null,
): string {
  return getRapidRouterBrandSnippets(maxEntries, maxChars, workspaceId);
}
