import { Router } from "express";
import type { AppUser, Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { acceptBrandInviteForUser, hashInviteToken } from "../lib/auth/brandInvite.js";
import { EMAIL_RE, findAppUserForAuth, normalizeEmail, normalizeUsPhoneToStored } from "../lib/auth/identifiers.js";
import { hashPassword, passwordLengthError, verifyPassword } from "../lib/auth/password.js";
import { normalizeUsername, USERNAME_RE, USERNAME_REQUIREMENTS_ERROR } from "../lib/auth/username.js";
import {
  attachClearSessionCookie,
  createSessionCookieForUser,
  requireAuth,
  revokeSessionByCookie,
} from "../lib/auth/sessionDb.js";
import { ensurePersonalWorkspaceBoard } from "../lib/taskDefaults.js";

const router = Router();

class BrandInviteRejectedError extends Error {
  override readonly name = "BrandInviteRejectedError";
}

const NAME_RE = /^[\p{L}\p{M}'\-. ]{1,80}$/u;

function trimName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function publicUser(u: AppUser) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    phone: u.phone,
    firstName: u.firstName,
    lastName: u.lastName,
    displayName: u.displayName,
    role: u.role,
  };
}

router.get("/me", (req, res) => {
  if (!req.appUser) {
    res.json({ user: null });
    return;
  }
  res.json({ user: req.appUser });
});

router.post("/login", async (req, res) => {
  try {
    const body = req.body as { login?: string; username?: string; password?: string };
    const loginRaw =
      typeof body.login === "string" ? body.login : typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!loginRaw.trim() || !password) {
      res.status(400).json({ error: "email or username or phone, and password, are required" });
      return;
    }
    const user = await findAppUserForAuth(prisma, loginRaw);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid sign-in or password" });
      return;
    }
    const { setCookie } = await createSessionCookieForUser(user.id);
    res.setHeader("Set-Cookie", setCookie);
    res.json({ user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const body = req.body as {
      username?: string;
      password?: string;
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
      brandInviteToken?: string;
    };
    const brandInviteToken =
      typeof body.brandInviteToken === "string" ? body.brandInviteToken.trim() : "";
    const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const phoneRaw = typeof body.phone === "string" ? body.phone : "";
    const firstName = typeof body.firstName === "string" ? trimName(body.firstName) : "";
    const lastName = typeof body.lastName === "string" ? trimName(body.lastName) : "";

    if (!username || !password || !email || !phoneRaw || !firstName || !lastName) {
      res.status(400).json({
        error: "first name, last name, email, username, phone, and password are required",
      });
      return;
    }
    if (!USERNAME_RE.test(username)) {
      res.status(400).json({ error: USERNAME_REQUIREMENTS_ERROR });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: "enter a valid email address" });
      return;
    }
    const phone = normalizeUsPhoneToStored(phoneRaw);
    if (!phone) {
      res.status(400).json({ error: "enter a valid US phone number (10 digits)" });
      return;
    }
    if (!NAME_RE.test(firstName) || !NAME_RE.test(lastName)) {
      res.status(400).json({ error: "names may only include letters, spaces, hyphen, apostrophe, or period" });
      return;
    }
    const pwErr = passwordLengthError(password);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }
    const displayName = `${firstName} ${lastName}`.trim();
    const passwordHash = await hashPassword(password);
    let user: AppUser;
    try {
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.appUser.create({
          data: {
            username,
            email,
            phone,
            passwordHash,
            firstName,
            lastName,
            displayName,
            role: "user",
          },
        });
        if (brandInviteToken) {
          const inv = await acceptBrandInviteForUser(tx, {
            token: brandInviteToken,
            userId: created.id,
            email,
          });
          if (!inv.ok) {
            throw new BrandInviteRejectedError();
          }
        }
        return created;
      });
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined;
      if (code === "P2002") {
        res.status(409).json({ error: "That email, phone number, or username is already in use" });
        return;
      }
      if (e instanceof BrandInviteRejectedError) {
        res.status(400).json({
          error:
            "This registration link is invalid, expired, or the email you entered does not match the invitation.",
        });
        return;
      }
      throw e;
    }
    await ensurePersonalWorkspaceBoard({ id: user.id, role: user.role });
    const { setCookie } = await createSessionCookieForUser(user.id);
    res.setHeader("Set-Cookie", setCookie);
    res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    await revokeSessionByCookie(req);
    attachClearSessionCookie(res);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Logout failed" });
  }
});

/** Public: validate an invite link before sign-up or sign-in. */
router.get("/brand-invite-preview", async (req, res) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }
    const tokenHash = hashInviteToken(token);
    const inv = await prisma.brandInvite.findFirst({
      where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
      include: {
        brand: { select: { id: true, name: true } },
        invitedBy: { select: { displayName: true, firstName: true, lastName: true, username: true } },
      },
    });
    if (!inv) {
      res.status(404).json({ error: "Invite not found or expired" });
      return;
    }
    const inviter =
      inv.invitedBy.displayName?.trim() ||
      [inv.invitedBy.firstName, inv.invitedBy.lastName].filter(Boolean).join(" ").trim() ||
      inv.invitedBy.username;
    res.json({
      brandId: inv.brand.id,
      brandName: inv.brand.name,
      inviterLabel: inviter,
      email: inv.email,
      expiresAt: inv.expiresAt.toISOString(),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load invite" });
  }
});

router.post("/brand-invite/accept", requireAuth, async (req, res) => {
  try {
    const body = req.body as { token?: string };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }
    const uid = req.appUser!.id;
    const email = req.appUser!.email;
    const result = await prisma.$transaction((tx) =>
      acceptBrandInviteForUser(tx, { token, userId: uid, email }),
    );
    if (!result.ok) {
      const status = result.reason === "email_mismatch" ? 403 : 400;
      res.status(status).json({
        error:
          result.reason === "email_mismatch"
            ? "This invite was sent to a different email address than the account you are signed in with."
            : "Invite is invalid or has expired.",
      });
      return;
    }
    res.json({ ok: true, brandId: result.brandId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to accept invite" });
  }
});

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const body = req.body as {
      username?: string;
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
      displayName?: string | null;
    };
    const username =
      body.username !== undefined ? normalizeUsername(String(body.username)) : undefined;
    const email = body.email !== undefined ? normalizeEmail(String(body.email)) : undefined;
    const phoneRaw = body.phone !== undefined ? String(body.phone) : undefined;
    const firstName = body.firstName !== undefined ? trimName(String(body.firstName)) : undefined;
    const lastName = body.lastName !== undefined ? trimName(String(body.lastName)) : undefined;
    let displayName: string | null | undefined;
    if (body.displayName !== undefined) {
      const d = String(body.displayName).trim();
      displayName = d.length ? d : null;
    }

    const data: Prisma.AppUserUpdateInput = {};
    if (username !== undefined) {
      if (!USERNAME_RE.test(username)) {
        res.status(400).json({ error: USERNAME_REQUIREMENTS_ERROR });
        return;
      }
      data.username = username;
    }
    if (email !== undefined) {
      if (!EMAIL_RE.test(email)) {
        res.status(400).json({ error: "enter a valid email address" });
        return;
      }
      data.email = email;
    }
    if (phoneRaw !== undefined) {
      const phone = normalizeUsPhoneToStored(phoneRaw);
      if (!phone) {
        res.status(400).json({ error: "enter a valid US phone number (10 digits)" });
        return;
      }
      data.phone = phone;
    }
    if (firstName !== undefined) {
      if (!NAME_RE.test(firstName)) {
        res.status(400).json({ error: "first name has invalid characters" });
        return;
      }
      data.firstName = firstName;
    }
    if (lastName !== undefined) {
      if (!NAME_RE.test(lastName)) {
        res.status(400).json({ error: "last name has invalid characters" });
        return;
      }
      data.lastName = lastName;
    }
    if (displayName !== undefined) {
      data.displayName = displayName;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "no valid fields to update" });
      return;
    }

    let user: AppUser;
    try {
      user = await prisma.appUser.update({
        where: { id: req.appUser!.id },
        data,
      });
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined;
      if (code === "P2002") {
        res.status(409).json({ error: "That email, phone number, or username is already in use" });
        return;
      }
      throw e;
    }
    res.json({ user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Profile update failed" });
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const body = req.body as { currentPassword?: string; newPassword?: string };
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "current password and new password are required" });
      return;
    }
    const newPwErr = passwordLengthError(newPassword);
    if (newPwErr) {
      res.status(400).json({ error: newPwErr });
      return;
    }
    const row = await prisma.appUser.findUniqueOrThrow({ where: { id: req.appUser!.id } });
    if (!(await verifyPassword(currentPassword, row.passwordHash))) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    await prisma.appUser.update({
      where: { id: row.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Password change failed" });
  }
});

export default router;
