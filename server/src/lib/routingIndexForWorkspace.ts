import { prisma } from "./db.js";
import { brandDisplayNameFromProfileJson } from "./brandDisplayName.js";

const MAX_TASKS_PER_LIST = 24;
const MAX_NOTE_TITLES = 40;

export type RoutingIndexPayload = {
  workspaceId: string;
  workspaceName: string;
  brandDisplayName: string | null;
  notesFolders: { id: string; title: string }[];
  recentNoteTitles: string[];
  brainstormSessions: { id: string; title: string }[];
  projectSpaces: {
    id: string;
    name: string;
    boards: {
      id: string;
      name: string;
      lists: {
        id: string;
        title: string;
        key: string | null;
        taskTitles: string[];
      }[];
    }[];
  }[];
};

/** Structured index for Mail Clerk / Rapid Router (API + prompt text). */
export async function buildRoutingIndexPayload(workspaceId: string): Promise<RoutingIndexPayload | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      brand: { select: { brandProfile: true } },
      notesFolders: {
        where: { parentId: null },
        orderBy: { position: "asc" },
        select: { id: true, title: true },
      },
      notes: {
        orderBy: { updatedAt: "desc" },
        take: MAX_NOTE_TITLES,
        select: { title: true },
      },
      projectSpaces: {
        where: { archivedAt: null },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          boards: {
            where: { archivedAt: null },
            orderBy: { position: "asc" },
            select: {
              id: true,
              name: true,
              lists: {
                orderBy: { position: "asc" },
                select: {
                  id: true,
                  title: true,
                  key: true,
                  tasks: {
                    where: { archivedAt: null },
                    orderBy: { order: "asc" },
                    take: MAX_TASKS_PER_LIST,
                    select: { title: true },
                  },
                },
              },
            },
          },
        },
      },
      brainstormProject: {
        select: {
          sessions: {
            orderBy: { updatedAt: "desc" },
            take: 20,
            select: { id: true, title: true },
          },
        },
      },
    },
  });

  if (!ws) return null;

  const brandDisplayName = brandDisplayNameFromProfileJson(ws.brand?.brandProfile ?? null);

  return {
    workspaceId: ws.id,
    workspaceName: ws.name,
    brandDisplayName,
    notesFolders: ws.notesFolders.map((f) => ({ id: f.id, title: f.title })),
    recentNoteTitles: ws.notes.map((n) => n.title).filter(Boolean),
    brainstormSessions: ws.brainstormProject?.sessions ?? [],
    projectSpaces: ws.projectSpaces.map((ps) => ({
      id: ps.id,
      name: ps.name,
      boards: ps.boards.map((b) => ({
        id: b.id,
        name: b.name,
        lists: b.lists.map((l) => ({
          id: l.id,
          title: l.title,
          key: l.key,
          taskTitles: l.tasks.map((t) => t.title),
        })),
      })),
    })),
  };
}

/** Compact text block for LLM prompts (token-aware). */
export function routingIndexToPromptText(idx: RoutingIndexPayload): string {
  const lines: string[] = [];
  lines.push(`Workspace: ${idx.workspaceName}`);
  if (idx.brandDisplayName) lines.push(`Brand (display): ${idx.brandDisplayName}`);
  lines.push("");
  lines.push("## Notebooks (top-level folders)");
  if (idx.notesFolders.length === 0) lines.push("(none)");
  else idx.notesFolders.forEach((f) => lines.push(`- ${f.title} [folder:${f.id}]`));
  if (idx.recentNoteTitles.length) {
    lines.push("");
    lines.push("## Recent note titles (sample)");
    idx.recentNoteTitles.slice(0, 20).forEach((t) => lines.push(`- ${t}`));
  }
  lines.push("");
  lines.push("## Brainstorm sessions");
  if (idx.brainstormSessions.length === 0) lines.push("(none — new session may be created on send)");
  else
    idx.brainstormSessions.forEach((s) => lines.push(`- ${s.title} [session:${s.id}]`));
  lines.push("");
  lines.push("## Boards & lists (tasks sample)");
  for (const ps of idx.projectSpaces) {
    lines.push(`### Project space: ${ps.name} [space:${ps.id}]`);
    for (const b of ps.boards) {
      lines.push(`  Board: ${b.name} [board:${b.id}]`);
      for (const l of b.lists) {
        const key = l.key ? ` key=${l.key}` : "";
        lines.push(`    List: ${l.title}${key} [list:${l.id}]`);
        for (const title of l.taskTitles.slice(0, 8)) {
          lines.push(`      • ${title}`);
        }
        if (l.taskTitles.length > 8) lines.push(`      … +${l.taskTitles.length - 8} more`);
      }
    }
  }
  return lines.join("\n").slice(0, 28_000);
}
