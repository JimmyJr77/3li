import type { BrandProfile } from "@/features/brand/types";
import { normalizeBrandProfile } from "@/features/brand/types";

function mergeDeep(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      out[k] = v;
      continue;
    }
    if (v !== null && typeof v === "object") {
      const prev = out[k];
      const prevObj =
        prev !== null && typeof prev === "object" && !Array.isArray(prev) ? (prev as Record<string, unknown>) : {};
      out[k] = mergeDeep(prevObj, v as Record<string, unknown>);
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** Deep-merge a partial kit object from the Brand Rep Agent into the editor state. */
export function mergeBrandProfilePatch(base: BrandProfile, patch: Record<string, unknown>): BrandProfile {
  const merged = mergeDeep(base as unknown as Record<string, unknown>, patch);
  return normalizeBrandProfile(merged);
}
