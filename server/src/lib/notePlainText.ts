/** Collect all text nodes from a TipTap/ProseMirror JSON doc. */
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

/** Plain text for AI prompts (single block of text). */
export function extractFullPlainText(contentJson: unknown): string {
  const out: string[] = [];
  collectText(contentJson, out);
  return out.join(" ").replace(/\s+/g, " ").trim();
}
