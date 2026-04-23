import { prisma } from "../db.js";
import { ensurePersonalWorkspaceBoard } from "../taskDefaults.js";
import { hashPassword } from "./password.js";

/** Bootstrap accounts requested for this deployment (local / first run). */
const SEED_ADMIN_USERNAME = "admin";
const SEED_ADMIN_PASSWORD = "G@tor$11admin";
const SEED_JIMMY_USERNAME = "jimmyobrien";
const SEED_JIMMY_PASSWORD = "G@tor$11";

export async function ensureSeedUsers(): Promise<void> {
  let admin = await prisma.appUser.findUnique({ where: { username: SEED_ADMIN_USERNAME } });
  if (!admin) {
    admin = await prisma.appUser.create({
      data: {
        username: SEED_ADMIN_USERNAME,
        passwordHash: await hashPassword(SEED_ADMIN_PASSWORD),
        displayName: "Administrator",
        role: "admin",
      },
    });
  } else if (admin.role !== "admin") {
    await prisma.appUser.update({ where: { id: admin.id }, data: { role: "admin" } });
    admin = { ...admin, role: "admin" };
  }

  let jimmy = await prisma.appUser.findUnique({ where: { username: SEED_JIMMY_USERNAME } });
  if (!jimmy) {
    jimmy = await prisma.appUser.create({
      data: {
        username: SEED_JIMMY_USERNAME,
        passwordHash: await hashPassword(SEED_JIMMY_PASSWORD),
        displayName: "Jimmy O'Brien",
        role: "user",
      },
    });
  }

  await prisma.brand.updateMany({
    where: { ownerUserId: null },
    data: { ownerUserId: admin.id },
  });

  await ensurePersonalWorkspaceBoard({ id: jimmy.id, role: jimmy.role });
  await ensurePersonalWorkspaceBoard({ id: admin.id, role: admin.role });
}
