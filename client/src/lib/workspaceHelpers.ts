import type { WorkspaceDto } from "@/features/taskflow/types";

/** First board in the primary project space — used for quick links when a default board is needed. */
export function getDefaultBoardId(ws: WorkspaceDto | null | undefined): string | undefined {
  const ps = ws?.projectSpaces?.[0];
  return ps?.boards?.[0]?.id;
}
