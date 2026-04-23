import { Router } from "express";
import type { AppUser } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { EMAIL_RE, findAppUserForAuth, normalizeEmail, normalizeUsPhoneToStored } from "../lib/auth/identifiers.js";
import { hashPassword, verifyPassword } from "../lib/auth/password.js";
import { attachClearSessionCookie, createSessionCookieForUser, revokeSessionByCookie } from "../lib/auth/sessionDb.js";
import { ensurePersonalWorkspaceBoard } from "../lib/taskDefaults.js";

const router = Router();

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;
const NAME_RE = /^[\p{L}\p{M}'\-. ]{1,80}$/u;

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

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
    };
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
      res.status(400).json({
        error: "username must be 3–32 characters: lowercase letters, digits, or underscore",
      });
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
    if (password.length < 8) {
      res.status(400).json({ error: "password must be at least 8 characters" });
      return;
    }
    const displayName = `${firstName} ${lastName}`.trim();
    const passwordHash = await hashPassword(password);
    let user: AppUser;
    try {
      user = await prisma.appUser.create({
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
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined;
      if (code === "P2002") {
        res.status(409).json({ error: "That email, phone number, or username is already in use" });
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

export default router;
