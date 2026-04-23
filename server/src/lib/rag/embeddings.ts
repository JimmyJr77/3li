import { embeddingModel } from "../ai/models.js";
import { getEmbeddingsOpenAIOrNull } from "../ai/provider.js";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const openai = getEmbeddingsOpenAIOrNull();
  if (!openai) {
    throw new Error("EMBEDDINGS_UNAVAILABLE");
  }
  const out: number[][] = [];
  const batchSize = 64;
  const model = embeddingModel();
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await openai.embeddings.create({
      model,
      input: batch,
    });
    const ordered = [...res.data].sort((x, y) => x.index - y.index);
    for (const item of ordered) {
      out.push(item.embedding as number[]);
    }
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}
