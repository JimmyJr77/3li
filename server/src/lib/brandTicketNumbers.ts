import { prisma } from "./db.js";

/** Reserve `count` sequential ticket numbers for a brand (1-based, monotonic). */
export async function allocateBrandTicketNumbers(brandId: string, count: number): Promise<number[]> {
  if (count <= 0) return [];
  return prisma.$transaction(async (tx) => {
    const b = await tx.brand.findUnique({ where: { id: brandId } });
    if (!b) return [];
    const start = b.nextTicketNumber;
    await tx.brand.update({
      where: { id: brandId },
      data: { nextTicketNumber: start + count },
    });
    return Array.from({ length: count }, (_, i) => start + i);
  });
}
