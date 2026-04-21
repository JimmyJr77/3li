import { prisma } from "../db.js";
import { cosineSimilarity } from "./cosine.js";

export type SearchHit = {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  score: number;
};

export async function searchProjectChunks(
  projectId: string,
  queryEmbedding: number[],
  topK: number,
): Promise<SearchHit[]> {
  const chunks = await prisma.documentChunk.findMany({
    where: { document: { projectId } },
    include: { document: { select: { id: true, filename: true } } },
  });

  const scored = chunks
    .map((c) => {
      const emb = c.embedding as unknown as number[];
      return {
        chunkId: c.id,
        documentId: c.documentId,
        filename: c.document.filename,
        content: c.content,
        score: cosineSimilarity(queryEmbedding, emb),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}
