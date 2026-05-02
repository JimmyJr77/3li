/** Stored next-themes values for the red zinc marketing shell (public site). */
export const PUBLIC_MARKETING_THEMES = ["public-red-light", "public-red-dark"] as const;
export type PublicMarketingTheme = (typeof PUBLIC_MARKETING_THEMES)[number];

/** Workspace / app color themes (class names → index.css). Primary hue is `data-accent-palette` on <html>. */
export const WORKSPACE_COLOR_THEMES = ["light", "dark", "vibrant", "rainbow-explosion"] as const;
export type WorkspaceColorTheme = (typeof WORKSPACE_COLOR_THEMES)[number];

/** Namespace version — bump when removing combined themes (light-red, etc.) so clients migrate cleanly. */
export const THEME_STORAGE_KEY = "3li-theme-v3";

/** All theme ids registered on ThemeProvider. */
export const REGISTERED_THEMES = [...PUBLIC_MARKETING_THEMES, ...WORKSPACE_COLOR_THEMES] as const satisfies readonly string[];

export function isPublicMarketingTheme(theme: string | undefined): boolean {
  return theme === "public-red-light" || theme === "public-red-dark";
}

export function isWorkspaceColorTheme(theme: string | undefined): theme is WorkspaceColorTheme {
  return (
    theme === "light" ||
    theme === "dark" ||
    theme === "vibrant" ||
    theme === "rainbow-explosion"
  );
}

/** Zinc marketing “dark mode” (hero + chrome): Red Dark only. */
export function marketingZincIsDark(theme: string | undefined): boolean {
  return theme === "public-red-dark";
}

/** Landing sections: zinc dark vs light; workspace dark only for app themes on public. */
export function landingContentIsDark(theme: string | undefined): boolean {
  if (isPublicMarketingTheme(theme)) {
    return marketingZincIsDark(theme);
  }
  return theme === "dark";
}
