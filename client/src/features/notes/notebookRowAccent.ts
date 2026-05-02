import type { CSSProperties } from "react";

/** Eight preset accents that read well on light, dark, vibrant, and rainbow themes as soft row tints. */
export const ROW_ACCENT_PRESET_HEX = [
  "#e11d48",
  "#ea580c",
  "#ca8a04",
  "#65a30d",
  "#059669",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
] as const;

export function isValidRowAccentHex(s: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(s.trim());
}

/** Normalized `#rrggbb` or null if missing / invalid. */
export function normalizeRowAccentHex(hex: string | null | undefined): string | null {
  if (hex == null || hex === "") return null;
  const h = hex.trim().toLowerCase();
  return isValidRowAccentHex(h) ? h : null;
}

/**
 * Like {@link browseRowAccentBrowseRow}, plus `--browse-row-accent` for hover overrides
 * on child controls (see `[data-notes-row-accent]` in `index.css`).
 */
export function browseRowAccentRowStyle(
  hex: string | null | undefined,
  active: boolean,
): CSSProperties | undefined {
  const h = normalizeRowAccentHex(hex);
  const tint = browseRowAccentBrowseRow(hex, active);
  if (h == null) return tint;
  return {
    ...(tint ?? {}),
    ["--browse-row-accent" as string]: h,
  };
}

/**
 * Notebook / note browse row tint: soft gradient when idle; ~50% accent fill when selected
 * (keeps the same inset left bar in both states).
 */
export function browseRowAccentBrowseRow(
  hex: string | null | undefined,
  active: boolean,
): CSSProperties | undefined {
  if (hex == null || hex === "") return undefined;
  const h = hex.trim().toLowerCase();
  if (!isValidRowAccentHex(h)) return undefined;
  if (active) {
    return {
      backgroundColor: `${h}80`,
      boxShadow: `inset 3px 0 0 0 ${h}`,
    };
  }
  return {
    backgroundImage: `linear-gradient(90deg, ${h}26 0%, ${h}0f 45%, transparent 100%)`,
    boxShadow: `inset 3px 0 0 0 ${h}`,
  };
}

/** @deprecated Use {@link browseRowAccentBrowseRow}(hex, false) */
export function browseRowAccentSurface(hex: string | null | undefined): CSSProperties | undefined {
  return browseRowAccentBrowseRow(hex, false);
}
