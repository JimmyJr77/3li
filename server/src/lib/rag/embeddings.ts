import type OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";

export async function embedTexts(openai: OpenAI, texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  const batchSize = 64;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    const ordered = [...res.data].sort((x, y) => x.index - y.index);
    for (const item of ordered) {
      out.push(item.embedding as number[]);
    }
  }
  return out;
}

export async function embedQuery(openai: OpenAI, text: string): Promise<number[]> {
  const [vec] = await embedTexts(openai, [text]);
  return vec;
}
