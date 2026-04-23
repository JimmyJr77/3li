import axios from "axios";

function viteApiBase(): string {
  const v = import.meta.env.VITE_API_BASE_URL;
  if (typeof v !== "string") return "";
  return v.trim().replace(/\/$/, "");
}

/**
 * Absolute URL for paths like `/api/health`. When `VITE_API_BASE_URL` is unset, returns a
 * root-relative path (Vite dev proxy or API on the same host).
 */
export function resolveApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = viteApiBase();
  return base ? `${base}${p}` : p;
}

export const api = axios.create({
  baseURL: viteApiBase() || "/",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});
