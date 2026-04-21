import { extractPreviewFromDoc } from "./extractPreview";

function collectText(node: unknown, out: string[]) {
  if (node === null || node === undefined) return;
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (typeof node !== "object") return;
  const o = node as { text?: string; content?: unknown[] };
  if (typeof o.text === "string") out.push(o.text);
  if (Array.isArray(o.content)) {
    for (const c of o.content) collectText(c, out);
  }
}

function blobFromDoc(doc: unknown): string {
  const out: string[] = [];
  collectText(doc, out);
  return out.join("");
}

/** `[[Title]]` targets in a TipTap doc. */
export function extractWikiTitlesFromDoc(doc: unknown): string[] {
  const blob = blobFromDoc(doc);
  const titles = new Set<string>();
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob)) !== null) {
    const t = m[1].trim();
    if (t) titles.add(t);
  }
  return [...titles];
}

export function titleMatchesWiki(blob: string, targetTitle: string): boolean {
  const t = targetTitle.trim().toLowerCase();
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob)) !== null) {
    if (m[1].trim().toLowerCase() === t) return true;
  }
  return false;
}

export function previewFromDoc(doc: unknown): string {
  return extractPreviewFromDoc(doc);
}
