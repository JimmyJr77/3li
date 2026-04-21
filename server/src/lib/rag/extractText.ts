import { createRequire } from "node:module";
import mammoth from "mammoth";

const require = createRequire(import.meta.url);
// pdf-parse is CommonJS; load lazily for ESM compatibility
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text?: string }>;

export async function extractTextFromBuffer(buf: Buffer, mime: string, filename: string): Promise<string> {
  const lower = filename.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    const data = await pdfParse(buf);
    return (data.text ?? "").trim();
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer: buf });
    return (result.value ?? "").trim();
  }
  if (
    mime.startsWith("text/") ||
    lower.endsWith(".md") ||
    lower.endsWith(".txt") ||
    mime === "application/markdown"
  ) {
    return buf.toString("utf8").trim();
  }
  throw new Error(`Unsupported file type: ${mime} (${filename})`);
}
