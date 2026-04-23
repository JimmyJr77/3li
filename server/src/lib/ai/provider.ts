import OpenAI from "openai";

export type AiBackend = "openai" | "ollama" | "groq";

function isVercelRuntime(): boolean {
  const v = process.env.VERCEL?.trim().toLowerCase();
  return v === "1" || v === "true";
}

/**
 * Which LLM backend the server uses for **chat** (OpenAI SDK-compatible).
 * - `AI_PROVIDER=openai|ollama|groq` overrides automatic selection.
 * - On Vercel (`VERCEL`), if `GROQ_API_KEY` is set → **groq** (unless overridden above).
 * - Else `NODE_ENV === "production"` → **openai**
 * - Else → **ollama** (local dev)
 */
export function resolveAiBackend(): AiBackend {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === "openai" || explicit === "ollama" || explicit === "groq") {
    return explicit;
  }
  if (isVercelRuntime() && process.env.GROQ_API_KEY?.trim()) {
    return "groq";
  }
  return process.env.NODE_ENV === "production" ? "openai" : "ollama";
}

/** True when the resolved **chat** backend has required credentials. */
export function isAiBackendConfigured(): boolean {
  const b = resolveAiBackend();
  if (b === "ollama") {
    return true;
  }
  if (b === "groq") {
    return Boolean(process.env.GROQ_API_KEY?.trim());
  }
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function ollamaOpenAIBaseUrl(): string {
  const raw = (process.env.OLLAMA_HOST ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  return raw.endsWith("/v1") ? raw : `${raw}/v1`;
}

const GROQ_OPENAI_BASE = "https://api.groq.com/openai/v1";

/**
 * OpenAI SDK client for **chat completions** (OpenAI, Groq, or Ollama `/v1`).
 */
export function getOpenAIOrNull(): OpenAI | null {
  const backend = resolveAiBackend();
  if (backend === "ollama") {
    return new OpenAI({
      baseURL: ollamaOpenAIBaseUrl(),
      apiKey: process.env.OLLAMA_API_KEY?.trim() || "ollama",
    });
  }
  if (backend === "groq") {
    const key = process.env.GROQ_API_KEY?.trim();
    if (!key) {
      return null;
    }
    const base = (process.env.GROQ_BASE_URL ?? GROQ_OPENAI_BASE).replace(/\/$/, "");
    const baseURL = base.endsWith("/v1") ? base : `${base}/v1`;
    return new OpenAI({ baseURL, apiKey: key });
  }
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return null;
  }
  return new OpenAI({ apiKey: key });
}

/**
 * Client used only for **embeddings**. Groq does not offer `/v1/embeddings`, so when the chat
 * backend is Groq we use the standard Open API with `OPENAI_API_KEY` (same key is fine for embed-only usage).
 */
export function getEmbeddingsOpenAIOrNull(): OpenAI | null {
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
  const b = resolveAiBackend();
  if (b === "openai") {
    return "OPENAI_API_KEY is not configured";
  }
  if (b === "groq") {
    return "GROQ_API_KEY is not configured";
  }
  return "Ollama is selected but the client could not be created (check OLLAMA_HOST)";
}

export function embeddingsServiceUnavailableDetail(): string {
  const b = resolveAiBackend();
  if (b === "groq") {
    return "OPENAI_API_KEY is required for document embeddings when using Groq (Groq has no embeddings API)";
  }
  if (b === "openai") {
    return "OPENAI_API_KEY is not configured";
  }
  return "Ollama is not configured for embeddings (check OLLAMA_HOST and embedding models)";
}
