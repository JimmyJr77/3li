/** Plain text from a TipTap/ProseMirror JSON doc (best-effort). */
export function extractPlainTextFromDoc(doc: unknown, maxLen = 12000): string {
  try {
    const parts: string[] = [];
    const walk = (n: unknown) => {
      if (n === null || n === undefined) return;
      if (typeof n === "string") {
        parts.push(n);
        return;
      }
      if (typeof n !== "object") return;
      const o = n as { type?: string; text?: string; content?: unknown[] };
      if (typeof o.text === "string") parts.push(o.text);
      if (Array.isArray(o.content)) {
        for (const c of o.content) walk(c);
      }
    };
    walk(doc);
    return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, maxLen);
  } catch {
    return "";
  }
}

/** Short plain-text preview from a TipTap/ProseMirror JSON doc (best-effort). */
export function extractPreviewFromDoc(doc: unknown, maxLen = 280): string {
  return extractPlainTextFromDoc(doc, maxLen);
}
