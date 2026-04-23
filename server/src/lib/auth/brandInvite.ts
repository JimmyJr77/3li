import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { normalizeEmail } from "./identifiers.js";

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function newInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString("hex");
  return { token, tokenHash: hashInviteToken(token) };
}

export type AcceptBrandInviteResult =
  | { ok: true; brandId: string }
  | { ok: false; reason: "invalid_or_expired" | "email_mismatch" };

export async function acceptBrandInviteForUser(
  db: Prisma.TransactionClient,
  opts: { token: string; userId: string; email: string },
): Promise<AcceptBrandInviteResult> {
  const tokenHash = hashInviteToken(opts.token);
  const inv = await db.brandInvite.findFirst({
    where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
    include: { brand: { select: { id: true, ownerUserId: true } } },
  });
  if (!inv) {
    return { ok: false, reason: "invalid_or_expired" };
  }
  if (normalizeEmail(inv.email) !== normalizeEmail(opts.email)) {
    return { ok: false, reason: "email_mismatch" };
  }
  const brandId = inv.brandId;
  if (inv.brand.ownerUserId === opts.userId) {
    await db.brandInvite.update({
      where: { id: inv.id },
      data: { consumedAt: new Date(), consumedByUserId: opts.userId },
    });
    return { ok: true, brandId };
  }
  await db.brandMember.upsert({
    where: { brandId_userId: { brandId, userId: opts.userId } },
    create: {
      brandId,
      userId: opts.userId,
      invitedByUserId: inv.invitedByUserId,
    },
    update: {},
  });
  await db.brandInvite.update({
    where: { id: inv.id },
    data: { consumedAt: new Date(), consumedByUserId: opts.userId },
  });
  return { ok: true, brandId };
}
