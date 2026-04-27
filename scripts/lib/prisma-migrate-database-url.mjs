/**
 * @param {string} urlString
 * @param {string} key
 * @param {string} value
 */
function ensureSearchParam(urlString, key, value) {
  try {
    const u = new URL(urlString);
    if (!u.searchParams.has(key)) {
      u.searchParams.set(key, value);
    }
    return u.toString();
  } catch {
    return urlString;
  }
}

/**
 * URL Prisma Migrate should use. Neon pooler hosts break migrate ("migration persistence is not initialized");
 * use DIRECT_URL or the same endpoint with `-pooler.` removed from the hostname.
 *
 * Neon direct connections from CI (Vercel) can cold-start slowly; a longer connect timeout reduces flaky P1001.
 *
 * @param {string} databaseUrl - typically `DATABASE_URL` / Neon pooler URI
 */
export function prismaMigrateDatabaseUrl(databaseUrl) {
  let out = databaseUrl;
  const direct = process.env.DIRECT_URL?.trim();
  if (direct && !/\b(localhost|127\.0\.0\.1)\b/i.test(direct)) {
    out = direct;
  } else {
    try {
      const u = new URL(databaseUrl);
      if (u.hostname.includes("-pooler.")) {
        const next = new URL(databaseUrl);
        next.hostname = next.hostname.replace("-pooler.", ".");
        out = next.toString();
      }
    } catch {
      /* ignore */
    }
  }

  if (/\.neon\.tech\b/i.test(out)) {
    out = ensureSearchParam(out, "connect_timeout", "45");
  }
  return out;
}
