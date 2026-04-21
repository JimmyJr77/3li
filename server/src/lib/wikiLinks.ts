import { prisma } from "./db.js";

/** Collect all text from a TipTap/ProseMirror JSON doc. */
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

/** Extract `[[Target title]]` wikilink targets from editor JSON. */
export function extractWikiTitlesFromDoc(contentJson: unknown): string[] {
  const parts: string[] = [];
  collectText(contentJson, parts);
  const blob = parts.join("");
  const titles = new Set<string>();
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob)) !== null) {
    const t = m[1].trim();
    if (t.length > 0) titles.add(t);
  }
  return [...titles];
}

/** Replace outgoing links from this note based on `[[Title]]` mentions in content. */
export async function syncNoteLinksFromContent(
  fromNoteId: string,
  workspaceId: string,
  contentJson: unknown,
) {
  const titles = extractWikiTitlesFromDoc(contentJson);
  await prisma.noteLink.deleteMany({ where: { fromNoteId } });

  for (const raw of titles) {
    const target = await prisma.note.findFirst({
      where: {
        workspaceId,
        title: { equals: raw, mode: "insensitive" },
        NOT: { id: fromNoteId },
      },
    });
    if (!target) continue;
    try {
      await prisma.noteLink.create({
        data: { fromNoteId, toNoteId: target.id },
      });
    } catch {
      // ignore unique races
    }
  }
}
