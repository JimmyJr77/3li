import { prisma } from "../db.js";
import { ensurePersonalWorkspaceBoard } from "../taskDefaults.js";
import { normalizeEmail } from "./identifiers.js";
import { hashPassword, verifyPassword } from "./password.js";

const SEED_ADMIN_USERNAME = "admin";
const LOCAL_DEV_DEFAULT_ADMIN_PASSWORD = "admin";
const JIMMY_USERNAME = "jimmyobrien";
const JIMMY_EMAIL = normalizeEmail("team.threelionsindustries@gmail.com");
const JIMMY_PHONE = "619-838-5897";

export async function ensureSeedUsers(): Promise<void> {
  const isDev = process.env.NODE_ENV === "development";
  const seedAdminPasswordFromEnv = process.env.SEED_ADMIN_PASSWORD?.trim();
  /** In development, `admin` / `admin` (override with `SEED_ADMIN_PASSWORD`). In production, only env. */
  const adminPlainPassword = seedAdminPasswordFromEnv || (isDev ? LOCAL_DEV_DEFAULT_ADMIN_PASSWORD : undefined);
  const jimmyPassword = process.env.SEED_JIMMY_PASSWORD?.trim();

  let admin = await prisma.appUser.findUnique({ where: { username: SEED_ADMIN_USERNAME } });
  if (!admin) {
    if (!adminPlainPassword) {
      console.warn(
        "[seed] No `admin` user yet. Set SEED_ADMIN_PASSWORD in .env and restart to create the default admin account.",
      );
    } else {
      if (isDev && !seedAdminPasswordFromEnv) {
        console.log(
          `[seed] Creating local dev admin (username "${SEED_ADMIN_USERNAME}", password "${LOCAL_DEV_DEFAULT_ADMIN_PASSWORD}"). Set SEED_ADMIN_PASSWORD to use a different password for new installs.`,
        );
      }
      admin = await prisma.appUser.create({
        data: {
          username: SEED_ADMIN_USERNAME,
          email: `${SEED_ADMIN_USERNAME}@legacy.internal`,
          phone: null,
          passwordHash: await hashPassword(adminPlainPassword),
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
    if (
      adminPlainPassword &&
      !(await verifyPassword(adminPlainPassword, admin.passwordHash))
    ) {
      updates.passwordHash = await hashPassword(adminPlainPassword);
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
