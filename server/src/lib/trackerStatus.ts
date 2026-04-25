import type { TrackerStatus } from "@prisma/client";

/** Display / DnD order for tracker columns (left → right). */
export const TRACKER_STATUS_ORDER: TrackerStatus[] = [
  "FREE_SPACE",
  "CONTEXT",
  "BRAINSTORM",
  "BACKLOG",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

export const TRACKER_STATUS_LABELS: Record<TrackerStatus, string> = {
  FREE_SPACE: "Free Space",
  CONTEXT: "Context",
  BRAINSTORM: "Brainstorm",
  BACKLOG: "Backlog",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

export function parseLaneKey(raw: string): { subBoardId: string; trackerStatus: TrackerStatus } | null {
  const i = raw.indexOf("|");
  if (i <= 0) return null;
  const subBoardId = raw.slice(0, i);
  const status = raw.slice(i + 1) as TrackerStatus;
  if (!TRACKER_STATUS_ORDER.includes(status)) return null;
  return { subBoardId, trackerStatus: status };
}

export function laneKey(subBoardId: string, trackerStatus: TrackerStatus): string {
  return `${subBoardId}|${trackerStatus}`;
}
