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

/** Subtle gradient + left bar for notebook/note browse rows. */
export function browseRowAccentSurface(hex: string | null | undefined): CSSProperties | undefined {
  if (hex == null || hex === "") return undefined;
  const h = hex.trim().toLowerCase();
  if (!isValidRowAccentHex(h)) return undefined;
  return {
    backgroundImage: `linear-gradient(90deg, ${h}26 0%, ${h}0f 45%, transparent 100%)`,
    boxShadow: `inset 3px 0 0 0 ${h}`,
  };
}
