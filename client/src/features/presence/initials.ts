import type { PresencePeer } from "./types";

export function presencePeerLabel(p: PresencePeer): string {
  const dn = p.displayName?.trim();
  if (dn) return dn;
  const fn = p.firstName?.trim();
  const ln = p.lastName?.trim();
  if (fn && ln) return `${fn} ${ln}`;
  if (fn) return fn;
  if (ln) return ln;
  return p.username;
}

export function presencePeerInitials(p: PresencePeer): string {
  const dn = p.displayName?.trim();
  if (dn) {
    const parts = dn.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]!;
      const b = parts[parts.length - 1]!;
      return (a[0]! + b[0]!).toUpperCase();
    }
    const w = parts[0] ?? dn;
    return w.slice(0, 2).toUpperCase();
  }
  const f = p.firstName?.trim();
  const l = p.lastName?.trim();
  if (f && l) return (f[0]! + l[0]!).toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  return p.username.slice(0, 2).toUpperCase();
}
