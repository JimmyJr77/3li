import { ACCENT_PALETTE_STORAGE_KEY, type AccentPaletteId } from "@/lib/accentPalette";
import { THEME_STORAGE_KEY, WORKSPACE_COLOR_THEMES } from "@/lib/themeIds";

const LEGACY_THEME_KEY = "3li-theme-v2";

const LEGACY_COMBINED: Record<string, { mode: string; accent: AccentPaletteId }> = {
  "light-red": { mode: "light", accent: "red" },
  "dark-red": { mode: "dark", accent: "red" },
  "vibrant-red": { mode: "vibrant", accent: "red" },
};

function isWorkspaceMode(s: string): boolean {
  return (WORKSPACE_COLOR_THEMES as readonly string[]).includes(s);
}

/**
 * Run once before React: copy v2 theme → v3 + accent when upgrading storage namespace.
 */
export function migrateThemeLocalStorageV2ToV3(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(THEME_STORAGE_KEY)) return;
    const raw = window.localStorage.getItem(LEGACY_THEME_KEY);
    if (!raw) return;
    const trimmed = raw.replace(/^"|"$/g, "").trim();
    const split = LEGACY_COMBINED[trimmed];
    if (split) {
      window.localStorage.setItem(THEME_STORAGE_KEY, split.mode);
      window.localStorage.setItem(ACCENT_PALETTE_STORAGE_KEY, split.accent);
      return;
    }
    if (isWorkspaceMode(trimmed) || trimmed.startsWith("public-red-")) {
      window.localStorage.setItem(THEME_STORAGE_KEY, trimmed);
    }
  } catch {
    /* ignore */
  }
}
