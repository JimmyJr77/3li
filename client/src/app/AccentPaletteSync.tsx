import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  applyAccentPaletteToDocument,
  getAccentPalette,
  migrateLegacyCombinedTheme,
  setAccentPalette,
} from "@/lib/accentPalette";

/**
 * Keeps `data-accent-palette` on <html> in sync with localStorage and migrates
 * legacy combined theme ids (light-red, dark-red, vibrant-red) to mode + accent.
 */
export function AccentPaletteSync() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const active = theme ?? undefined;
    const migrated = migrateLegacyCombinedTheme(active);
    if (migrated) {
      setAccentPalette(migrated.accent);
      setTheme(migrated.mode);
      return;
    }
    applyAccentPaletteToDocument(getAccentPalette());
  }, [mounted, theme, setTheme]);

  return null;
}
