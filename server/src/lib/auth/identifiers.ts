import type { AppUser, PrismaClient } from "@prisma/client";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Valid US 10-digit → ###-###-#### */
export function normalizeUsPhoneToStored(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let d = digits;
  if (d.length === 11 && d.startsWith("1")) {
    d = d.slice(1);
  }
  if (d.length !== 10 || !/^\d{10}$/.test(d)) {
    return null;
  }
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Resolve sign-in input: email (contains @), else phone if 10 US digits, else username.
 */
export async function findAppUserForAuth(prisma: PrismaClient, rawLogin: string): Promise<AppUser | null> {
  const trimmed = rawLogin.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("@")) {
    const email = normalizeEmail(trimmed);
    if (!EMAIL_RE.test(email)) {
      return null;
    }
    return prisma.appUser.findUnique({ where: { email } });
  }

  const phone = normalizeUsPhoneToStored(trimmed);
  if (phone) {
    const byPhone = await prisma.appUser.findUnique({ where: { phone } });
    if (byPhone) {
      return byPhone;
    }
  }

  const username = trimmed.toLowerCase();
  if (!username) {
    return null;
  }
  return prisma.appUser.findUnique({ where: { username } });
}
