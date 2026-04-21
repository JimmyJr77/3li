import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { OpenAI } from "openai";
import { prisma } from "../db.js";
import { chunkText } from "./chunkText.js";
import { embedTexts } from "./embeddings.js";
import { extractTextFromBuffer } from "./extractText.js";

const ALLOWED_EXT = new Set([".pdf", ".docx", ".txt", ".md", ".markdown"]);

export type IngestLocalResult = {
  scanned: number;
  indexed: number;
  skipped: number;
  capped?: boolean;
  errors: string[];
};

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) {
        continue;
      }
      out.push(...(await walkFiles(p)));
    } else {
      const ext = path.extname(e.name).toLowerCase();
      if (ALLOWED_EXT.has(ext)) {
        out.push(p);
      }
    }
  }
  return out;
}

function resolveUnderRoot(root: string, relativeOrAbsolute: string): string {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, relativeOrAbsolute);
  const rel = path.relative(resolvedRoot, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path escapes LOCAL_INGEST_ROOT");
  }
  return target;
}

export async function ingestLocalPath(params: {
  openai: OpenAI;
  projectId: string;
  threadId?: string;
  /** Path relative to LOCAL_INGEST_ROOT, or absolute path under that root after resolve */
  relativePath: string;
  maxFiles: number;
}): Promise<IngestLocalResult> {
  const root = process.env.LOCAL_INGEST_ROOT;
  if (!root) {
    throw new Error("LOCAL_INGEST_ROOT is not configured");
  }

  const targetDir = resolveUnderRoot(root, params.relativePath);
  const stat = await fs.stat(targetDir).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error("Not a directory or inaccessible");
  }

  const discovered = await walkFiles(targetDir);
  const allFiles = discovered.slice(0, params.maxFiles);
  const errors: string[] = [];
  let indexed = 0;
  let skipped = 0;

  for (const filePath of allFiles) {
    try {
      const buf = await fs.readFile(filePath);
      const filename = path.basename(filePath);
      const mime =
        filename.endsWith(".pdf") ? "application/pdf"
        : filename.endsWith(".docx") ?
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "text/plain";

      const text = await extractTextFromBuffer(buf, mime, filename);
      if (!text.trim()) {
        skipped += 1;
        continue;
      }

      const hash = createHash("sha256").update(buf).digest("hex");
      const pieces = chunkText(text);
      if (pieces.length === 0) {
        skipped += 1;
        continue;
      }

      const embeddings = await embedTexts(params.openai, pieces);

      await prisma.$transaction(async (tx) => {
        const d = await tx.chatDocument.create({
          data: {
            projectId: params.projectId,
            threadId: params.threadId,
            filename: `${filename} (local:${path.relative(targetDir, filePath) || filename})`,
            mime,
            source: "repo_scan",
            contentHash: hash,
            status: "ready",
            extractedText: text.slice(0, 50_000),
          },
        });
        for (let i = 0; i < pieces.length; i++) {
          await tx.documentChunk.create({
            data: {
              documentId: d.id,
              chunkIndex: i,
              content: pieces[i],
              embedding: embeddings[i] as object,
            },
          });
        }
      });
      indexed += 1;
    } catch (e) {
      errors.push(`${filePath}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    scanned: discovered.length,
    indexed,
    skipped,
    capped: discovered.length > params.maxFiles,
    errors,
  };
}
