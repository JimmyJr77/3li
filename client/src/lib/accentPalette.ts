/** User-chosen primary / chrome family; composes with Light, Vibrant, or Dark theme mode (next-themes class). */
export const ACCENT_PALETTE_IDS = [
  "default",
  "red",
  "orange",
  "amber",
  "emerald",
  "cyan",
  "violet",
  "ice",
] as const;
export type AccentPaletteId = (typeof ACCENT_PALETTE_IDS)[number];

export const ACCENT_PALETTE_STORAGE_KEY = "3li-accent-palette";

const LEGACY_THEME_ACCENTS: Record<string, { mode: string; accent: AccentPaletteId }> = {
  "light-red": { mode: "light", accent: "red" },
  "dark-red": { mode: "dark", accent: "red" },
  "vibrant-red": { mode: "vibrant", accent: "red" },
};

export function isAccentPaletteId(s: string | null | undefined): s is AccentPaletteId {
  return ACCENT_PALETTE_IDS.includes(s as AccentPaletteId);
}

export function getAccentPalette(): AccentPaletteId {
  if (typeof window === "undefined") return "default";
  const raw = window.localStorage.getItem(ACCENT_PALETTE_STORAGE_KEY);
  if (raw && isAccentPaletteId(raw)) return raw;
  return "default";
}

export function setAccentPalette(palette: AccentPaletteId): void {
  if (typeof window === "undefined") return;
  if (palette === "default") {
    window.localStorage.removeItem(ACCENT_PALETTE_STORAGE_KEY);
  } else {
    window.localStorage.setItem(ACCENT_PALETTE_STORAGE_KEY, palette);
  }
  applyAccentPaletteToDocument(palette);
}

export function applyAccentPaletteToDocument(palette: AccentPaletteId): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (palette === "default") {
    el.removeAttribute("data-accent-palette");
  } else {
    el.setAttribute("data-accent-palette", palette);
  }
}

/** If `theme` is a removed combined id (e.g. light-red), return the split mode + accent. */
export function migrateLegacyCombinedTheme(theme: string | undefined): {
  mode: string;
  accent: AccentPaletteId;
} | null {
  if (!theme) return null;
  const hit = LEGACY_THEME_ACCENTS[theme];
  return hit ? { mode: hit.mode, accent: hit.accent } : null;
}

export const ACCENT_LABELS: Record<AccentPaletteId, string> = {
  default: "Blue (default)",
  red: "Red",
  orange: "Orange",
  amber: "Amber",
  emerald: "Emerald",
  cyan: "Cyan",
  violet: "Violet",
  ice: "Ice (glass)",
};

/** CSS `background` values for small swatches in settings and theme menus. */
export const ACCENT_SWATCH_GRADIENT: Record<AccentPaletteId, string> = {
  default: "linear-gradient(135deg, oklch(0.45 0.22 262), oklch(0.65 0.18 230))",
  red: "linear-gradient(135deg, #ff0000, oklch(0.55 0.22 28))",
  orange: "linear-gradient(135deg, oklch(0.55 0.2 48), oklch(0.7 0.16 55))",
  amber: "linear-gradient(135deg, oklch(0.62 0.18 78), oklch(0.78 0.14 85))",
  emerald: "linear-gradient(135deg, oklch(0.5 0.16 152), oklch(0.65 0.14 165))",
  cyan: "linear-gradient(135deg, oklch(0.52 0.14 210), oklch(0.68 0.12 200))",
  violet: "linear-gradient(135deg, oklch(0.48 0.22 290), oklch(0.62 0.18 305))",
  ice: "linear-gradient(135deg, oklch(0.96 0.01 260), oklch(0.88 0.02 260))",
};
