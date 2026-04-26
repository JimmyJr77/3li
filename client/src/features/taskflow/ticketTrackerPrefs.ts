import { TRACKER_STATUSES, type TrackerStatus } from "./trackerMeta";

const STORAGE_KEY = "ticket-tracker-column-visibility";

export type TicketTrackerColumnVisibility = Record<TrackerStatus, boolean>;

export function defaultColumnVisibility(): TicketTrackerColumnVisibility {
  return Object.fromEntries(TRACKER_STATUSES.map((s) => [s, true])) as TicketTrackerColumnVisibility;
}

export function loadColumnVisibility(): TicketTrackerColumnVisibility {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultColumnVisibility();
    const parsed = JSON.parse(raw) as Partial<Record<TrackerStatus, boolean>>;
    const next = defaultColumnVisibility();
    for (const s of TRACKER_STATUSES) {
      if (typeof parsed[s] === "boolean") next[s] = parsed[s]!;
    }
    return next;
  } catch {
    return defaultColumnVisibility();
  }
}

export function saveColumnVisibility(v: TicketTrackerColumnVisibility): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    // ignore
  }
}
