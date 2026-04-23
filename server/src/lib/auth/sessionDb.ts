import { createHash, randomBytes } from "node:crypto";
import type { Response, Request, NextFunction } from "express";
import { prisma } from "../db.js";
import { buildClearSessionCookie, buildSessionCookie, readCookieHeader, sessionCookieName } from "./cookies.js";

const SESSION_DAYS = 30;
const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function createSessionCookieForUser(userId: string): Promise<{ setCookie: string; token: string }> {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.appSession.create({
    data: { userId, tokenHash, expiresAt },
  });
  const maxAgeSec = SESSION_DAYS * 24 * 60 * 60;
  return { setCookie: buildSessionCookie(token, maxAgeSec), token };
}

export async function revokeSessionByCookie(req: Request): Promise<void> {
  const raw = readCookieHeader(req.headers.cookie, sessionCookieName());
  if (!raw) return;
  const tokenHash = hashToken(raw);
  await prisma.appSession.deleteMany({ where: { tokenHash } });
}

export function attachClearSessionCookie(res: Response): void {
  const cur = res.getHeader("Set-Cookie");
  const cleared = buildClearSessionCookie();
  if (!cur) {
    res.setHeader("Set-Cookie", cleared);
  } else if (Array.isArray(cur)) {
    res.setHeader("Set-Cookie", [...cur, cleared]);
  } else {
    res.setHeader("Set-Cookie", [String(cur), cleared]);
  }
}

export async function loadSessionUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const raw = readCookieHeader(req.headers.cookie, sessionCookieName());
    if (!raw) {
      next();
      return;
    }
    const tokenHash = hashToken(raw);
    const session = await prisma.appSession.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!session) {
      attachClearSessionCookie(res);
      next();
      return;
    }
    req.appUser = {
      id: session.user.id,
      username: session.user.username,
      email: session.user.email,
      phone: session.user.phone,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      displayName: session.user.displayName,
      role: session.user.role,
    };
    next();
  } catch (e) {
    console.error("[auth] loadSessionUser", e);
    next();
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.appUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
