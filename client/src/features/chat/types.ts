export type ConsultingMode = "strategy" | "financial" | "operations" | "technical";

export type AiBackendMetadata = {
  backend: "openai" | "ollama";
  chatModel: string;
  embeddingModel: string;
};

export type ChatBootstrap = {
  /** Which LLM stack the API uses (Ollama locally, OpenAI when deployed). */
  ai?: AiBackendMetadata;
  defaultProjectId: string;
  /** Consulting chat + RAG project id per brand workspace (same as brainstorm scope). */
  projectIdByWorkspaceId?: Record<string, string>;
  projects: { id: string; name: string }[];
  workspaces: {
    id: string;
    name: string;
    brandName: string;
    projectSpaces: {
      id: string;
      name: string;
      position: number;
      boards: { id: string; name: string; position: number }[];
    }[];
  }[];
  defaultWorkspaceId: string;
  defaultBoardId: string;
};

export type ChatThreadListItem = {
  id: string;
  projectId: string;
  title: string;
  consultingMode: string;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
};

export type ChatMessage = {
  id: string;
  threadId: string;
  role: string;
  content: string;
  citations: { ref: number; chunkId: string; filename: string }[] | null;
  createdAt: string;
};

export type StreamEvent =
  | { type: "meta"; threadId: string; projectId: string; consultingMode: string }
  | { type: "token"; text: string }
  | {
      type: "done";
      messageId: string;
      citations: { ref: number; chunkId: string; filename: string }[];
    }
  | { type: "error"; message: string };

export type ChatDocumentRow = {
  id: string;
  filename: string;
  mime: string;
  source: string;
  status: string;
  createdAt: string;
  threadId: string | null;
  _count: { chunks: number };
};
