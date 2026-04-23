import type { MailroomPlanChunk } from "@/features/agents/api";

export type MailPlanChunkRoute = {
  category: MailroomPlanChunk["suggestedDestination"];
  notesFolderId: string | null;
  boardsBoardId: string | null;
  boardsListId: string | null;
  brainstormSessionId: string | null;
};

export const MAIL_ADD_FOLDER = "__mail_add_folder__";
export const MAIL_ADD_BOARD = "__mail_add_board__";
export const MAIL_ADD_SESSION = "__mail_add_session__";
export const MAIL_ADD_BRAND = "__mail_add_brand__";

/** Parse `[board:abc]`, `[folder:def]` from Mail Clerk target hints. */
export function parseBracketHint(hint: string, kind: "board" | "list" | "folder" | "session"): string | null {
  const m = hint.match(new RegExp(`\\[${kind}:([^\\]]+)\\]`, "i"));
  const id = m?.[1]?.trim();
  return id || null;
}

export function buildChunkRoutesFromPlan(
  chunks: MailroomPlanChunk[],
  ctx: {
    defaultNotesFolderId: string | null;
    validFolderIds: Set<string>;
    firstBoardId: string | null;
    validBoardIds: Set<string>;
    firstBrainstormSessionId: string | null;
    validSessionIds: Set<string>;
  },
): MailPlanChunkRoute[] {
  return chunks.map((c) => {
    const hint = c.targetHint ?? "";
    const folderFromHint = parseBracketHint(hint, "folder");
    const boardFromHint = parseBracketHint(hint, "board");
    const listFromHint = parseBracketHint(hint, "list");
    const sessionFromHint = parseBracketHint(hint, "session");

    const category = c.suggestedDestination;

    let notesFolderId = ctx.defaultNotesFolderId;
    if (folderFromHint && ctx.validFolderIds.has(folderFromHint)) {
      notesFolderId = folderFromHint;
    }

    let boardsBoardId: string | null = ctx.firstBoardId;
    let boardsListId: string | null = listFromHint;
    if (boardFromHint && ctx.validBoardIds.has(boardFromHint)) {
      boardsBoardId = boardFromHint;
      boardsListId = listFromHint;
    } else {
      boardsListId = listFromHint && boardFromHint ? listFromHint : null;
    }

    let brainstormSessionId = ctx.firstBrainstormSessionId;
    if (sessionFromHint && ctx.validSessionIds.has(sessionFromHint)) {
      brainstormSessionId = sessionFromHint;
    }

    return {
      category,
      notesFolderId,
      boardsBoardId,
      boardsListId,
      brainstormSessionId,
    };
  });
}
