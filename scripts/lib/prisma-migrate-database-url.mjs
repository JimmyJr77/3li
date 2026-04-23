/**
 * URL Prisma Migrate should use. Neon pooler hosts break migrate ("migration persistence is not initialized");
 * use DIRECT_URL or the same endpoint with `-pooler.` removed from the hostname.
 *
 * @param {string} databaseUrl - typically `DATABASE_URL` / Neon pooler URI
 */
export function prismaMigrateDatabaseUrl(databaseUrl) {
  const direct = process.env.DIRECT_URL?.trim();
  if (direct && !/\b(localhost|127\.0\.0\.1)\b/i.test(direct)) {
    return direct;
  }
  try {
    const u = new URL(databaseUrl);
    if (u.hostname.includes("-pooler.")) {
      const next = new URL(databaseUrl);
      next.hostname = next.hostname.replace("-pooler.", ".");
      return next.toString();
    }
  } catch {
    /* ignore */
  }
  return databaseUrl;
}
