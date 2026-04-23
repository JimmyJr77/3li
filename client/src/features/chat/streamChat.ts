import { resolveApiUrl } from "@/lib/api/client";
import type { StreamEvent } from "./types";

export type StreamRequest = {
  projectId: string;
  threadId?: string | null;
  workspaceId?: string | null;
  consultingMode?: string;
  message: string;
  /** Rapid Router brand snippets (device); server merges with saved workspace kit. */
  brandCenterContext?: string;
};

export async function streamChatMessage(
  body: StreamRequest,
  onEvent: (e: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(resolveApiUrl("/api/chat/stream"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? res.statusText);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const block of parts) {
      const line = block.split("\n").find((l) => l.startsWith("data: "));
      if (!line) {
        continue;
      }
      const data = JSON.parse(line.slice(6)) as StreamEvent;
      onEvent(data);
    }
  }
  if (buf.trim()) {
    const line = buf.split("\n").find((l) => l.startsWith("data: "));
    if (line) {
      const data = JSON.parse(line.slice(6)) as StreamEvent;
      onEvent(data);
    }
  }
}
