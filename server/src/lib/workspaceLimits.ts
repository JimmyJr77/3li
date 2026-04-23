/** Keep in sync with client `WORKSPACE_NAME_MAX_LENGTH`. */
export const WORKSPACE_NAME_MAX_LENGTH = 64;

const WORKSPACE_TITLE_SUFFIX = " Workspace";

/**
 * Default ecosystem title for a brand workspace: `{brandName} Workspace`, truncated to fit DB limits.
 * Keep in sync with `defaultWorkspaceTitleFromBrandName` on the client.
 */
export function defaultWorkspaceTitleFromBrandName(brandName: string): string {
  const maxSeg = Math.max(1, WORKSPACE_NAME_MAX_LENGTH - WORKSPACE_TITLE_SUFFIX.length);
  const seg = brandName.trim().slice(0, maxSeg);
  return `${seg}${WORKSPACE_TITLE_SUFFIX}`;
}

export function normalizeWorkspaceName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim();
  if (!name) {
    return { ok: false, error: "name cannot be empty" };
  }
  if (name.length > WORKSPACE_NAME_MAX_LENGTH) {
    return { ok: false, error: `name must be at most ${WORKSPACE_NAME_MAX_LENGTH} characters` };
  }
  return { ok: true, name };
}
