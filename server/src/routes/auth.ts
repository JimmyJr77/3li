import { Router } from "express";
import { prisma } from "../lib/db.js";
import { hashPassword, verifyPassword } from "../lib/auth/password.js";
import { attachClearSessionCookie, createSessionCookieForUser, revokeSessionByCookie } from "../lib/auth/sessionDb.js";
import { ensurePersonalWorkspaceBoard } from "../lib/taskDefaults.js";

const router = Router();

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

router.get("/me", (req, res) => {
  if (!req.appUser) {
    res.json({ user: null });
    return;
  }
  res.json({
    user: {
      id: req.appUser.id,
      username: req.appUser.username,
      displayName: req.appUser.displayName,
      role: req.appUser.role,
    },
  });
});

router.post("/login", async (req, res) => {
  try {
    const body = req.body as { username?: string; password?: string };
    const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }
    const user = await prisma.appUser.findUnique({ where: { username } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    const { setCookie } = await createSessionCookieForUser(user.id);
    res.setHeader("Set-Cookie", setCookie);
    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const body = req.body as { username?: string; password?: string; displayName?: string };
    const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName =
      typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim() : null;
    if (!username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }
    if (!USERNAME_RE.test(username)) {
      res.status(400).json({
        error: "username must be 3–32 characters: lowercase letters, digits, or underscore",
      });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "password must be at least 8 characters" });
      return;
    }
    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await prisma.appUser.create({
        data: {
          username,
          passwordHash,
          displayName,
          role: "user",
        },
      });
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined;
      if (code === "P2002") {
        res.status(409).json({ error: "That username is already taken" });
        return;
      }
      throw e;
    }
    await ensurePersonalWorkspaceBoard({ id: user.id, role: user.role });
    const { setCookie } = await createSessionCookieForUser(user.id);
    res.setHeader("Set-Cookie", setCookie);
    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    });
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
