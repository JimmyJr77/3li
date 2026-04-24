const MAX = 12_000;

export function truncateForEvent(s: string, max = MAX): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 20)}\n…[truncated]`;
}

export function titleFromText(text: string, max = 72): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (!one) return "Untitled";
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`;
}
