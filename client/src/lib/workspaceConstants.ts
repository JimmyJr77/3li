/** Max length for `Workspace.name` in API (server must match). */
export const WORKSPACE_NAME_MAX_LENGTH = 64;

const WORKSPACE_TITLE_SUFFIX = " Workspace";

/** Default ecosystem title: `{brandName} Workspace`, truncated to 64 chars (matches server). */
export function defaultWorkspaceTitleFromBrandName(brandName: string): string {
  const maxSeg = Math.max(1, WORKSPACE_NAME_MAX_LENGTH - WORKSPACE_TITLE_SUFFIX.length);
  const seg = brandName.trim().slice(0, maxSeg);
  return `${seg}${WORKSPACE_TITLE_SUFFIX}`;
}

/** Visible characters in sidebar / mobile chrome before truncation + tooltip. */
export const WORKSPACE_DISPLAY_NAME_MAX = 28;

/** Max length for Brand Center identity display name (chrome / switcher). */
export const BRAND_DISPLAY_NAME_INPUT_MAX = 40;

export const ACTIVE_WORKSPACE_STORAGE_KEY = "3li-active-workspace-id";

/** Once per browser tab session: user confirmed which brand/workspace to use when multiple exist. */
export const BRAND_ENTRY_SESSION_KEY = "3li-brand-pick-v1";

export function truncateWorkspaceDisplayName(
  name: string,
  max: number = WORKSPACE_DISPLAY_NAME_MAX,
): string {
  const t = name.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}
