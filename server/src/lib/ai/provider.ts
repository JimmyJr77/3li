import OpenAI from "openai";

export type AiBackend = "openai" | "ollama";

/**
 * Which LLM/embeddings backend the server uses.
 * - `AI_PROVIDER=openai|ollama` overrides automatic selection.
 * - Otherwise: production → OpenAI, non-production → Ollama (local dev and tests).
 */
export function resolveAiBackend(): AiBackend {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === "openai" || explicit === "ollama") {
    return explicit;
  }
  return process.env.NODE_ENV === "production" ? "openai" : "ollama";
}

/** True when the resolved backend has required configuration (API key for OpenAI; Ollama is always attempted). */
export function isAiBackendConfigured(): boolean {
  if (resolveAiBackend() === "ollama") {
    return true;
  }
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function ollamaOpenAIBaseUrl(): string {
  const raw = (process.env.OLLAMA_HOST ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  return raw.endsWith("/v1") ? raw : `${raw}/v1`;
}

/**
 * OpenAI SDK client: either the cloud API or Ollama's OpenAI-compatible `/v1` surface.
 */
export function getOpenAIOrNull(): OpenAI | null {
  const backend = resolveAiBackend();
  if (backend === "ollama") {
    return new OpenAI({
      baseURL: ollamaOpenAIBaseUrl(),
      apiKey: process.env.OLLAMA_API_KEY?.trim() || "ollama",
    });
  }
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return null;
  }
  return new OpenAI({ apiKey: key });
}

export function aiServiceUnavailableDetail(): string {
  if (resolveAiBackend() === "openai") {
    return "OPENAI_API_KEY is not configured";
  }
  return "Ollama is selected but the client could not be created (check OLLAMA_HOST)";
}
