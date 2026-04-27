import { api } from "@/lib/api/client";
import type { PresencePeer } from "./types";

export async function postPresenceHeartbeat(roomKey: string, tabId: string): Promise<PresencePeer[]> {
  const { data } = await api.post<{ peers: PresencePeer[] }>("/api/presence/heartbeat", { roomKey, tabId });
  return data.peers ?? [];
}
