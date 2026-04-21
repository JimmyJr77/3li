export function chunkText(text: string, maxChars = 900, overlap = 120): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) {
    return [];
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < t.length) {
    let end = Math.min(start + maxChars, t.length);
    if (end < t.length) {
      const slice = t.slice(start, end);
      const breakAt = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "), slice.lastIndexOf(" "));
      if (breakAt > maxChars * 0.35) {
        end = start + breakAt + 1;
      }
    }
    const piece = t.slice(start, end).trim();
    if (piece) {
      chunks.push(piece);
    }
    const nextStart = end - overlap;
    start = nextStart > start ? nextStart : end;
    if (start >= t.length) {
      break;
    }
  }
  return chunks;
}
