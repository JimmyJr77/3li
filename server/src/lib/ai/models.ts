import { resolveAiBackend, type AiBackend } from "./provider.js";

export type ChatModelKind = "primary" | "mini" | "jsonQuick";

/** Chat completion model for the active backend (override with env vars). */
export function chatModel(kind: ChatModelKind): string {
  const b = resolveAiBackend();
  if (b === "ollama") {
    const single = process.env.OLLAMA_CHAT_MODEL?.trim();
    if (single) {
      return single;
    }
    if (kind === "mini" || kind === "jsonQuick") {
      const mini = process.env.OLLAMA_CHAT_MODEL_MINI?.trim();
      if (mini) {
        return mini;
      }
    }
    return "llama3.2";
  }
  if (b === "groq") {
    if (kind === "mini") {
      return process.env.GROQ_CHAT_MODEL_MINI?.trim() || "llama-3.1-8b-instant";
    }
    if (kind === "jsonQuick") {
      return process.env.GROQ_CHAT_MODEL_JSON?.trim() || "llama-3.1-8b-instant";
    }
    return process.env.GROQ_CHAT_MODEL?.trim() || "llama-3.3-70b-versatile";
  }
  if (kind === "mini") {
    return process.env.OPENAI_CHAT_MODEL_MINI?.trim() || "gpt-4.1-mini";
  }
  if (kind === "jsonQuick") {
    return process.env.OPENAI_CHAT_MODEL_JSON?.trim() || "gpt-4o-mini";
  }
  return process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4.1";
}

/** Embedding model id for the active embeddings client (see `getEmbeddingsOpenAIOrNull`). */
export function embeddingModel(): string {
  if (resolveAiBackend() === "ollama") {
    return process.env.OLLAMA_EMBEDDING_MODEL?.trim() || "nomic-embed-text";
  }
  return process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
}

export type AiPublicMetadata = {
  backend: AiBackend;
  chatModel: string;
  embeddingModel: string;
};

export function getAiPublicMetadata(): AiPublicMetadata {
  return {
    backend: resolveAiBackend(),
    chatModel: chatModel("primary"),
    embeddingModel: embeddingModel(),
  };
}
