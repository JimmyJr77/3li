import { useEffect, useState } from "react";

/**
 * Stable per-tab id for presence heartbeats, persisted for the session so refreshes don't look like a new viewer.
 */
export function usePresenceTabId(roomKey: string | null | undefined): string | null {
  const [tabId, setTabId] = useState<string | null>(null);

  useEffect(() => {
    if (!roomKey) {
      setTabId(null);
      return;
    }
    const storageKey = `presenceTab:${roomKey}`;
    let id = sessionStorage.getItem(storageKey);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(storageKey, id);
    }
    setTabId(id);
  }, [roomKey]);

  return tabId;
}
