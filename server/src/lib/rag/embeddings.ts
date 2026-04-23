import type OpenAI from "openai";
import { embeddingModel } from "../ai/models.js";

export async function embedTexts(openai: OpenAI, texts: string[]): Promise<number[][]> {
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

export async function embedQuery(openai: OpenAI, text: string): Promise<number[]> {
  const [vec] = await embedTexts(openai, [text]);
  return vec;
}
