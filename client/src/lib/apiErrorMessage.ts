import axios from "axios";

/** Normalize API / network errors for safe string display (avoids React "objects as children"). */
export function formatApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (typeof data === "string" && data.trim()) return data;
    if (data && typeof data === "object") {
      const o = data as Record<string, unknown>;
      if (typeof o.error === "string" && o.error.trim()) return o.error;
      if (typeof o.message === "string" && o.message.trim()) return o.message;
      if (o.error && typeof o.error === "object") {
        const inner = (o.error as Record<string, unknown>).message;
        if (typeof inner === "string" && inner.trim()) return inner;
      }
    }
    if (typeof err.message === "string" && err.message.trim()) return err.message;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}
