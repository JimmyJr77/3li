import { prisma } from "../db.js";
import { ensurePersonalWorkspaceBoard } from "../taskDefaults.js";
import { normalizeEmail } from "./identifiers.js";
import { hashPassword } from "./password.js";

const SEED_ADMIN_USERNAME = "admin";
const JIMMY_USERNAME = "jimmyobrien";
const JIMMY_EMAIL = normalizeEmail("team.threelionsindustries@gmail.com");
const JIMMY_PHONE = "619-838-5897";

export async function ensureSeedUsers(): Promise<void> {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  const jimmyPassword = process.env.SEED_JIMMY_PASSWORD?.trim();

  let admin = await prisma.appUser.findUnique({ where: { username: SEED_ADMIN_USERNAME } });
  if (!admin) {
    if (!adminPassword) {
      console.warn(
        "[seed] No `admin` user yet. Set SEED_ADMIN_PASSWORD in .env and restart to create the default admin account.",
      );
    } else {
      admin = await prisma.appUser.create({
        data: {
          username: SEED_ADMIN_USERNAME,
          email: `${SEED_ADMIN_USERNAME}@legacy.internal`,
          phone: null,
          passwordHash: await hashPassword(adminPassword),
          firstName: "System",
          lastName: "Administrator",
          displayName: "System Administrator",
          role: "admin",
        },
      });
    }
  } else {
    const updates: {
      role?: string;
      passwordHash?: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
    } = {};
    if (admin.role !== "admin") {
      updates.role = "admin";
    }
    if (adminPassword) {
      updates.passwordHash = await hashPassword(adminPassword);
    }
    if (!admin.firstName?.trim()) {
      updates.firstName = "System";
    }
    if (!admin.lastName?.trim()) {
      updates.lastName = "Administrator";
    }
    if (!admin.displayName?.trim() || admin.displayName.trim() === "Administrator") {
      updates.displayName = "System Administrator";
    }
    if (Object.keys(updates).length > 0) {
      admin = await prisma.appUser.update({ where: { id: admin.id }, data: updates });
    }
  }

  if (admin) {
    await prisma.brand.updateMany({
      where: { ownerUserId: null },
      data: { ownerUserId: admin.id },
    });
  }

  const jimmyExisting = await prisma.appUser.findFirst({
    where: { OR: [{ username: JIMMY_USERNAME }, { email: JIMMY_EMAIL }, { phone: JIMMY_PHONE }] },
  });

  if (jimmyExisting) {
    const updates: {
      username: string;
      email: string;
      phone: string;
      firstName: string;
      lastName: string;
      displayName: string;
      role: string;
      passwordHash?: string;
    } = {
      username: JIMMY_USERNAME,
      email: JIMMY_EMAIL,
      phone: JIMMY_PHONE,
      firstName: "Jimmy",
      lastName: "O'Brien",
      displayName: "Jimmy O'Brien",
      role: "admin",
    };
    if (jimmyPassword) {
      updates.passwordHash = await hashPassword(jimmyPassword);
    }
    await prisma.appUser.update({
      where: { id: jimmyExisting.id },
      data: updates,
    });
    const jimmy = await prisma.appUser.findUniqueOrThrow({ where: { id: jimmyExisting.id } });
    await ensurePersonalWorkspaceBoard({ id: jimmy.id, role: jimmy.role });
  } else if (!jimmyPassword) {
    console.warn(
      "[seed] Jimmy O'Brien admin seed not created yet. Set SEED_JIMMY_PASSWORD in .env and restart (username jimmyobrien, email team.threelionsindustries@gmail.com, phone 619-838-5897).",
    );
  } else {
    const jimmy = await prisma.appUser.create({
      data: {
        username: JIMMY_USERNAME,
        email: JIMMY_EMAIL,
        phone: JIMMY_PHONE,
        passwordHash: await hashPassword(jimmyPassword),
        firstName: "Jimmy",
        lastName: "O'Brien",
        displayName: "Jimmy O'Brien",
        role: "admin",
      },
    });
    await ensurePersonalWorkspaceBoard({ id: jimmy.id, role: jimmy.role });
  }

  if (admin) {
    await ensurePersonalWorkspaceBoard({ id: admin.id, role: admin.role });
  }
}
