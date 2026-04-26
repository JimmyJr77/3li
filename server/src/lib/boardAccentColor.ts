import { prisma } from "./db.js";

/** Distinct accents for project boards (aligned with client sub-board color chips). */
export const BOARD_ACCENT_PALETTE = [
  "#64748b",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#14b8a6",
  "#f97316",
] as const;

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

export function sanitizeBoardAccentColor(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const s = String(raw).trim();
  if (!HEX6.test(s)) return undefined;
  return s.toLowerCase();
}

/** Next color for a new board in this workspace (stable count-based rotation). */
export async function nextBoardAccentColorForWorkspace(workspaceId: string): Promise<string> {
  const n = await prisma.board.count({
    where: { projectSpace: { workspaceId }, archivedAt: null },
  });
  return BOARD_ACCENT_PALETTE[n % BOARD_ACCENT_PALETTE.length]!;
}

/** Next color for a new sub-board (`BoardList`) on this board (count-based rotation). */
export async function nextSubBoardAccentColorForBoard(boardId: string): Promise<string> {
  const n = await prisma.boardList.count({ where: { boardId } });
  return BOARD_ACCENT_PALETTE[n % BOARD_ACCENT_PALETTE.length]!;
}
