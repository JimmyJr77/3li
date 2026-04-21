import pptxgen from "pptxgenjs";

const MAX_BODY_SLIDES = 26;

/** One slide per non-empty paragraph; optional first-line markdown heading (## Title). */
export function splitIntoSlideBlocks(body: string): { heading?: string; text: string }[] {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }
  const paras = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, MAX_BODY_SLIDES);

  const out: { heading?: string; text: string }[] = [];
  for (const p of paras) {
    const lines = p.split("\n");
    const hm = lines[0].match(/^#{1,3}\s+(.+)$/);
    if (hm) {
      const rest = lines.slice(1).join("\n").trim();
      out.push({
        heading: hm[1].trim(),
        text: rest || " ",
      });
    } else {
      out.push({ text: p });
    }
  }
  return out;
}

export async function buildPptxBuffer(deckTitle: string, body: string): Promise<Buffer> {
  // pptxgenjs default export is constructable at runtime; types + NodeNext interop disagree.
  const Pptx = pptxgen as unknown as new () => {
    author: string;
    title: string;
    addSlide: () => {
      addText: (t: string, o: Record<string, unknown>) => void;
    };
    write: (p: { outputType: "arraybuffer" }) => Promise<ArrayBuffer>;
  };
  const pptx = new Pptx();
  pptx.author = "3LI Consulting Chat";
  pptx.title = deckTitle;

  const titleSlide = pptx.addSlide();
  titleSlide.addText(deckTitle, {
    x: 0.5,
    y: 2.2,
    w: 9,
    h: 1.5,
    fontSize: 28,
    bold: true,
    align: "center",
    valign: "middle",
  });
  titleSlide.addText("Exported from consulting chat", {
    x: 0.5,
    y: 4,
    w: 9,
    fontSize: 12,
    color: "666666",
    align: "center",
  });

  const chunks = splitIntoSlideBlocks(body);
  if (chunks.length === 0) {
    const slide = pptx.addSlide();
    slide.addText("(No body text)", { x: 0.5, y: 1, w: 9, fontSize: 14 });
  } else {
    for (const chunk of chunks) {
      const slide = pptx.addSlide();
      let y = 0.4;
      if (chunk.heading) {
        slide.addText(chunk.heading, {
          x: 0.5,
          y,
          w: 9,
          fontSize: 20,
          bold: true,
        });
        y += 0.85;
      }
      slide.addText(chunk.text || " ", {
        x: 0.5,
        y,
        w: 9,
        h: 4.5,
        fontSize: 13,
        valign: "top",
        fit: "shrink",
      });
    }
  }

  const out = await pptx.write({ outputType: "arraybuffer" });
  return Buffer.from(out as ArrayBuffer);
}

export function slugifyFilename(title: string): string {
  const s = title
    .trim()
    .slice(0, 80)
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  return s || "deck";
}
