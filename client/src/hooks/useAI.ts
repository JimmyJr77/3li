import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function useAI() {
  return useMutation({
    mutationFn: async (prompt: string) => {
      const res = await api.post<{
        result: string;
        threadId?: string;
        projectId?: string;
        citations?: { ref: number; chunkId: string; filename: string }[];
      }>("/api/ai/chat", { prompt });
      return res.data;
    },
  });
}
