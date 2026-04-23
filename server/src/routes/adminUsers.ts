import { Router } from "express";
import type { AppUser, Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { EMAIL_RE, normalizeEmail, normalizeUsPhoneToStored } from "../lib/auth/identifiers.js";
import { hashPassword, passwordLengthError } from "../lib/auth/password.js";
import { normalizeUsername, USERNAME_RE, USERNAME_REQUIREMENTS_ERROR } from "../lib/auth/username.js";
import { requireAuth } from "../lib/auth/sessionDb.js";
import { ensurePersonalWorkspaceBoard } from "../lib/taskDefaults.js";

const router = Router();

const NAME_RE = /^[\p{L}\p{M}'\-. ]{1,80}$/u;

function trimName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function publicUserRow(u: AppUser) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    phone: u.phone,
    firstName: u.firstName,
    lastName: u.lastName,
    displayName: u.displayName,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

async function countAdmins(): Promise<number> {
  return prisma.appUser.count({ where: { role: "admin" } });
}

router.use(requireAuth, (req, res, next) => {
  if (req.appUser!.role !== "admin") {
    res.status(403).json({ error: "Administrator access required" });
    return;
  }
  next();
});

router.get("/", async (_req, res) => {
  try {
    const rows = await prisma.appUser.findMany({
      orderBy: [{ role: "desc" }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        displayName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({
      users: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body as {
      username?: string;
      password?: string;
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
      displayName?: string | null;
      role?: string;
    };
    const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
    const firstName = typeof body.firstName === "string" ? trimName(body.firstName) : "";
    const lastName = typeof body.lastName === "string" ? trimName(body.lastName) : "";
    let displayName: string | null =
      body.displayName !== undefined && body.displayName !== null
        ? trimName(String(body.displayName)) || null
        : `${firstName} ${lastName}`.trim() || null;
    const role = body.role === "admin" ? "admin" : "user";

    if (!username || !password || !email || !firstName || !lastName) {
      res.status(400).json({
        error: "username, password, email, first name, and last name are required",
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
    let phone: string | null = null;
    if (phoneRaw) {
      const p = normalizeUsPhoneToStored(phoneRaw);
      if (!p) {
        res.status(400).json({ error: "enter a valid US phone number (10 digits), or omit phone" });
        return;
      }
      phone = p;
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
          role,
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
    res.status(201).json({ user: publicUserRow(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await prisma.appUser.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const body = req.body as {
      username?: string;
      email?: string;
      phone?: string | null;
      firstName?: string;
      lastName?: string;
      displayName?: string | null;
      role?: string;
    };

    const data: Prisma.AppUserUpdateInput = {};

    if (body.username !== undefined) {
      const username = normalizeUsername(String(body.username));
      if (!USERNAME_RE.test(username)) {
        res.status(400).json({ error: USERNAME_REQUIREMENTS_ERROR });
        return;
      }
      data.username = username;
    }
    if (body.email !== undefined) {
      const email = normalizeEmail(String(body.email));
      if (!EMAIL_RE.test(email)) {
        res.status(400).json({ error: "enter a valid email address" });
        return;
      }
      data.email = email;
    }
    if (body.phone !== undefined) {
      if (body.phone === null || String(body.phone).trim() === "") {
        data.phone = null;
      } else {
        const phone = normalizeUsPhoneToStored(String(body.phone));
        if (!phone) {
          res.status(400).json({ error: "enter a valid US phone number (10 digits), or clear phone" });
          return;
        }
        data.phone = phone;
      }
    }
    if (body.firstName !== undefined) {
      const firstName = trimName(String(body.firstName));
      if (!NAME_RE.test(firstName)) {
        res.status(400).json({ error: "first name has invalid characters" });
        return;
      }
      data.firstName = firstName;
    }
    if (body.lastName !== undefined) {
      const lastName = trimName(String(body.lastName));
      if (!NAME_RE.test(lastName)) {
        res.status(400).json({ error: "last name has invalid characters" });
        return;
      }
      data.lastName = lastName;
    }
    if (body.displayName !== undefined) {
      const d = String(body.displayName).trim();
      data.displayName = d.length ? d : null;
    }
    if (body.role !== undefined) {
      const nextRole = body.role === "admin" ? "admin" : "user";
      if (existing.role === "admin" && nextRole === "user") {
        const admins = await countAdmins();
        if (admins <= 1) {
          res.status(400).json({ error: "Cannot remove the last administrator" });
          return;
        }
      }
      data.role = nextRole;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "no valid fields to update" });
      return;
    }

    let user: AppUser;
    try {
      user = await prisma.appUser.update({ where: { id }, data });
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined;
      if (code === "P2002") {
        res.status(409).json({ error: "That email, phone number, or username is already in use" });
        return;
      }
      throw e;
    }
    res.json({ user: publicUserRow(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.post("/:id/password", async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await prisma.appUser.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const body = req.body as { newPassword?: string };
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!newPassword) {
      res.status(400).json({ error: "new password is required" });
      return;
    }
    const newPwErr = passwordLengthError(newPassword);
    if (newPwErr) {
      res.status(400).json({ error: newPwErr });
      return;
    }
    await prisma.appUser.update({
      where: { id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to set password" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (id === req.appUser!.id) {
      res.status(400).json({ error: "You cannot delete your own account from this screen" });
      return;
    }
    const existing = await prisma.appUser.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (existing.role === "admin") {
      const admins = await countAdmins();
      if (admins <= 1) {
        res.status(400).json({ error: "Cannot delete the last administrator" });
        return;
      }
    }
    await prisma.appUser.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
