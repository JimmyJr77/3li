import { prisma } from "./db.js";

const TEAM_SOFT_MAX = 12_000;
const USER_SOFT_MAX = 8_000;

function trimBlock(label: string, body: string, max: number): string {
  const t = body.trim();
  if (!t) return "";
  const slice = t.length > max ? `${t.slice(0, max)}\n…(truncated)` : t;
  return `${label}\n${slice}`;
}

/** Loads team (brand) and user (workspace) context for consulting chat assembly. */
export async function loadContextInstructionsForWorkspace(
  workspaceId: string | null | undefined,
): Promise<{ team: string; user: string }> {
  if (!workspaceId) {
    return { team: "", user: "" };
  }
  const row = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      userContextInstructions: true,
      brand: { select: { teamContextInstructions: true } },
    },
  });
  if (!row) {
    return { team: "", user: "" };
  }
  const team = (row.brand?.teamContextInstructions ?? "").trim();
  const user = (row.userContextInstructions ?? "").trim();
  return { team, user };
}

/**
 * Formatted blocks for system prompt: team first (highest precedence narrative), then user.
 */
export function formatTeamUserBlocksForPrompt(team: string, user: string): { teamBlock: string; userBlock: string } {
  const teamBlock = trimBlock("## Team context (overrides user on conflict)", team, TEAM_SOFT_MAX);
  const userBlock = trimBlock("## User context", user, USER_SOFT_MAX);
  return {
    teamBlock,
    userBlock,
  };
}

/** Team + user blocks for Brainstorm Studio (same precedence as consulting chat). */
export async function formatBrainstormContextAddonForBrainstorm(
  workspaceId: string | null | undefined,
): Promise<string> {
  const { team, user } = await loadContextInstructionsForWorkspace(workspaceId);
  const { teamBlock, userBlock } = formatTeamUserBlocksForPrompt(team, user);
  return [teamBlock, userBlock].filter(Boolean).join("\n\n");
}
