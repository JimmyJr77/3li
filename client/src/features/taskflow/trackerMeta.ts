/** Fixed tracker lanes (must match server `TrackerStatus` enum). */

export const TRACKER_STATUSES = [
  "FREE_SPACE",
  "CONTEXT",
  "BRAINSTORM",
  "BACKLOG",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
] as const;

export type TrackerStatus = (typeof TRACKER_STATUSES)[number];

export const TRACKER_LABELS: Record<TrackerStatus, string> = {
  FREE_SPACE: "Free Space",
  CONTEXT: "Context",
  BRAINSTORM: "Brainstorm",
  BACKLOG: "Backlog",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

export function laneKey(subBoardId: string, status: TrackerStatus): string {
  return `${subBoardId}|${status}`;
}

export function parseLaneKey(raw: string): { subBoardId: string; status: TrackerStatus } | null {
  const i = raw.indexOf("|");
  if (i <= 0) return null;
  const subBoardId = raw.slice(0, i);
  const status = raw.slice(i + 1) as TrackerStatus;
  if (!TRACKER_STATUSES.includes(status)) return null;
  return { subBoardId, status };
}

export function normalizeTrackerStatus(raw: string | undefined | null): TrackerStatus {
  if (raw && (TRACKER_STATUSES as readonly string[]).includes(raw)) return raw as TrackerStatus;
  return "BACKLOG";
}
