/** Canonical username: trimmed and lowercased for storage and uniqueness (case-insensitive matching). */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Validated against the normalized (lowercased) form. */
export const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

export const USERNAME_REQUIREMENTS_ERROR =
  "username must be 3–32 characters (letters, digits, or underscore); usernames are case-insensitive";
