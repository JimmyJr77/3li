import { useEffect, useState } from "react";
import { postPresenceHeartbeat } from "./api";
import type { PresencePeer } from "./types";

const HEARTBEAT_MS = 10_000;

/**
 * Registers this tab in `roomKey` and returns other users in the same room (Postgres-backed, polled).
 */
export function usePagePresence(roomKey: string | null | undefined, tabId: string | null | undefined): {
  peers: PresencePeer[];
} {
  const [peers, setPeers] = useState<PresencePeer[]>([]);

  useEffect(() => {
    if (!roomKey || !tabId) {
      setPeers([]);
      return;
    }

    let cancelled = false;

    const tick = async () => {
      try {
        const next = await postPresenceHeartbeat(roomKey, tabId);
        if (!cancelled) setPeers(next);
      } catch {
        if (!cancelled) setPeers([]);
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), HEARTBEAT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [roomKey, tabId]);

  return { peers };
}
