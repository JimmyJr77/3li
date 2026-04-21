/** Build a minimal TipTap JSON document from plain text (paragraphs per line). */
export function plainTextToTipTapDoc(text: string): Record<string, unknown> {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const content = lines.map((line) => ({
    type: "paragraph",
    content: line.length > 0 ? [{ type: "text", text: line }] : [],
  }));
  return { type: "doc", content };
}
