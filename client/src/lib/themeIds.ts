/** Stored next-themes values for the red zinc marketing shell (public site). */
export const PUBLIC_MARKETING_THEMES = ["public-red-light", "public-red-dark"] as const;
export type PublicMarketingTheme = (typeof PUBLIC_MARKETING_THEMES)[number];

/** Workspace / app color themes (unchanged class names → index.css). */
export const WORKSPACE_COLOR_THEMES = ["light", "dark", "vibrant", "rainbow-explosion"] as const;
export type WorkspaceColorTheme = (typeof WORKSPACE_COLOR_THEMES)[number];

/** Bumps localStorage namespace so legacy `light`/`dark` (marketing-only) do not map to workspace schemes. */
export const THEME_STORAGE_KEY = "3li-theme";

/** All theme ids registered on ThemeProvider (includes system). */
export const REGISTERED_THEMES = [
  ...PUBLIC_MARKETING_THEMES,
  ...WORKSPACE_COLOR_THEMES,
  "system",
] as const satisfies readonly string[];

export function isPublicMarketingTheme(theme: string | undefined): boolean {
  return theme === "system" || theme === "public-red-light" || theme === "public-red-dark";
}

export function isWorkspaceColorTheme(theme: string | undefined): theme is WorkspaceColorTheme {
  return (
    theme === "light" ||
    theme === "dark" ||
    theme === "vibrant" ||
    theme === "rainbow-explosion"
  );
}

/** Zinc marketing “dark mode” (hero + chrome): Red Dark, or system resolving to dark. */
export function marketingZincIsDark(theme: string | undefined, resolvedTheme: string | undefined): boolean {
  if (theme === "public-red-dark") return true;
  if (theme === "public-red-light") return false;
  if (theme === "system") return resolvedTheme === "dark";
  return false;
}

/** Landing sections: zinc dark/light, or workspace dark only (light / vibrant / rainbow read as “light”). */
export function landingContentIsDark(theme: string | undefined, resolvedTheme: string | undefined): boolean {
  if (isPublicMarketingTheme(theme)) {
    return marketingZincIsDark(theme, resolvedTheme);
  }
  return theme === "dark";
}
