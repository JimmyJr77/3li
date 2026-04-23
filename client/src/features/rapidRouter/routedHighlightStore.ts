import { useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "atlas.routedHighlights.v1";
const CHANGE_EVENT = "atlas-routed-highlight";

export type RoutedGlowKind = "note" | "task" | "brainstorm";

export type RoutedGlowRecord = {
  kind: RoutedGlowKind;
  workspaceId: string;
  id: string;
  /** Brainstorm: session that owns the node */
  sessionId?: string;
  ts: number;
};

type StoredShape = { v: 1; items: RoutedGlowRecord[] };

let clientVersion = 0;

function bump() {
  clientVersion += 1;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function parseStored(raw: string | null): RoutedGlowRecord[] {
  if (!raw) return [];
  try {
    const o = JSON.parse(raw) as unknown;
    if (!isRecord(o) || o.v !== 1 || !Array.isArray(o.items)) return [];
    const out: RoutedGlowRecord[] = [];
    for (const it of o.items) {
      if (!isRecord(it)) continue;
      const kind = it.kind;
      const workspaceId = it.workspaceId;
      const id = it.id;
      if (kind !== "note" && kind !== "task" && kind !== "brainstorm") continue;
      if (typeof workspaceId !== "string" || typeof id !== "string") continue;
      const ts = typeof it.ts === "number" ? it.ts : Date.now();
      const sessionId = typeof it.sessionId === "string" ? it.sessionId : undefined;
      if (kind === "brainstorm" && !sessionId) continue;
      out.push(
        kind === "brainstorm"
          ? { kind, workspaceId, id, sessionId, ts }
          : { kind, workspaceId, id, ts },
      );
    }
    return out;
  } catch {
    return [];
  }
}

export function readRoutedGlows(): RoutedGlowRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return parseStored(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function writeRoutedGlows(items: RoutedGlowRecord[]) {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredShape = { v: 1, items: items.slice(0, 80) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    bump();
  } catch {
    /* quota */
  }
}

export function markRoutedGlow(entry: Omit<RoutedGlowRecord, "ts"> & { ts?: number }) {
  const items = readRoutedGlows().filter(
    (x) =>
      !(
        x.kind === entry.kind &&
        x.id === entry.id &&
        x.workspaceId === entry.workspaceId &&
        (entry.kind !== "brainstorm" || x.sessionId === entry.sessionId)
      ),
  );
  items.unshift({ ...entry, ts: entry.ts ?? Date.now() });
  writeRoutedGlows(items);
}

export function clearRoutedGlow(
  kind: RoutedGlowKind,
  id: string,
  workspaceId: string,
  sessionId?: string | null,
) {
  const items = readRoutedGlows().filter((x) => {
    if (x.kind !== kind || x.id !== id || x.workspaceId !== workspaceId) return true;
    if (kind === "brainstorm" && sessionId && x.sessionId !== sessionId) return true;
    return false;
  });
  writeRoutedGlows(items);
}

export function subscribeRoutedGlow(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  const fn = () => onStoreChange();
  window.addEventListener(CHANGE_EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(CHANGE_EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

function getServerSnapshot() {
  return 0;
}

export function useRoutedGlowVersion(): number {
  return useSyncExternalStore(subscribeRoutedGlow, () => clientVersion, getServerSnapshot);
}

export function useRoutedNoteGlow(noteId: string | undefined, workspaceId: string | undefined): boolean {
  const v = useRoutedGlowVersion();
  return useMemo(() => {
    void v;
    if (!noteId || !workspaceId) return false;
    return readRoutedGlows().some((x) => x.kind === "note" && x.id === noteId && x.workspaceId === workspaceId);
  }, [v, noteId, workspaceId]);
}

export function useRoutedTaskGlow(taskId: string | undefined, workspaceId: string | undefined): boolean {
  const v = useRoutedGlowVersion();
  return useMemo(() => {
    void v;
    if (!taskId || !workspaceId) return false;
    return readRoutedGlows().some((x) => x.kind === "task" && x.id === taskId && x.workspaceId === workspaceId);
  }, [v, taskId, workspaceId]);
}

export function useRoutedBrainstormGlow(
  nodeId: string | undefined,
  workspaceId: string | undefined,
  sessionId: string | undefined,
): boolean {
  const v = useRoutedGlowVersion();
  return useMemo(() => {
    void v;
    if (!nodeId || !workspaceId || !sessionId) return false;
    return readRoutedGlows().some(
      (x) =>
        x.kind === "brainstorm" &&
        x.id === nodeId &&
        x.workspaceId === workspaceId &&
        x.sessionId === sessionId,
    );
  }, [v, nodeId, workspaceId, sessionId]);
}
