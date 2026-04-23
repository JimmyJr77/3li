/** Read Brand Center `identity.displayName` from stored JSON without full schema parse. */
export function brandDisplayNameFromProfileJson(brandProfile: unknown): string | null {
  if (!brandProfile || typeof brandProfile !== "object") return null;
  const identity = (brandProfile as { identity?: unknown }).identity;
  if (!identity || typeof identity !== "object") return null;
  const raw = (identity as { displayName?: unknown }).displayName;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}
