const START = "<<<STUDIO_CANVAS_JSON>>>";
const END = "<<<END_STUDIO_CANVAS_JSON>>>";

export type StudioCanvasProposalItem =
  | { type: "idea"; title: string; description?: string }
  | { type: "text"; text: string };

export type ParsedStudioCanvasBlock = {
  /** Reply text shown to the user (machine block stripped). */
  visibleText: string;
  proposals: StudioCanvasProposalItem[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeProposal(raw: unknown): StudioCanvasProposalItem | null {
  if (!isRecord(raw)) return null;
  const type = raw.type;
  if (type === "idea") {
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) return null;
    const description = typeof raw.description === "string" ? raw.description.trim() : undefined;
    return { type: "idea", title, ...(description ? { description } : {}) };
  }
  if (type === "text") {
    const text = typeof raw.text === "string" ? raw.text.trim() : "";
    if (!text) return null;
    return { type: "text", text };
  }
  return null;
}

/** Extract optional canvas JSON block from model output; cap items for safety. */
export function parseStudioCanvasProposal(raw: string, maxItems = 14): ParsedStudioCanvasBlock {
  const i = raw.indexOf(START);
  const j = raw.indexOf(END);
  if (i === -1 || j === -1 || j <= i) {
    return { visibleText: raw.trimEnd(), proposals: [] };
  }

  const jsonSlice = raw.slice(i + START.length, j).trim();
  const visibleText = raw.slice(0, i).trimEnd();

  let proposals: StudioCanvasProposalItem[] = [];
  try {
    const parsed: unknown = JSON.parse(jsonSlice);
    const arr = isRecord(parsed) && Array.isArray(parsed.proposals) ? parsed.proposals : null;
    if (arr) {
      for (const item of arr) {
        const n = normalizeProposal(item);
        if (n) proposals.push(n);
        if (proposals.length >= maxItems) break;
      }
    }
  } catch {
    proposals = [];
  }

  return { visibleText, proposals };
}
