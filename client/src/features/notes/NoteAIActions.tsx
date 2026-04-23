import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchNotesBootstrap, patchNote, postNoteAi } from "./api";
import { extractPreviewFromDoc } from "./extractPreview";
import { plainTextToTipTapDoc } from "./noteUtils";
import type { AtlasNoteDto } from "./types";

export function NoteAIActions({
  note,
  workspaceId,
  onUpdated,
  offline,
  embedded,
  extraContext,
}: {
  note: AtlasNoteDto;
  workspaceId: string;
  onUpdated: () => void;
  /** When true (browser-only storage), AI actions are unavailable */
  offline?: boolean;
  /** Omit outer card and section title when nested (e.g. Agents panel tab) */
  embedded?: boolean;
  /** Optional instructions appended to each AI request (e.g. from Agents panel context box) */
  extraContext?: string;
}) {
  const qc = useQueryClient();
  const { data: notesBootstrap } = useQuery({
    queryKey: ["notes-app", "bootstrap", workspaceId],
    queryFn: () => fetchNotesBootstrap(workspaceId),
  });
  const [output, setOutput] = useState<string | null>(null);
  const [lastKind, setLastKind] = useState<"summarize" | "rewrite" | null>(null);

  const aiOpts = () =>
    extraContext?.trim() ? { extraContext: extraContext.trim().slice(0, 4000) } : undefined;

  const summarize = useMutation({
    mutationFn: () => postNoteAi(note.id, "summarize", aiOpts()),
    onSuccess: (d) => {
      setLastKind("summarize");
      setOutput(d.result ?? "");
    },
  });

  const rewrite = useMutation({
    mutationFn: () => postNoteAi(note.id, "rewrite", aiOpts()),
    onSuccess: (d) => {
      setLastKind("rewrite");
      setOutput(d.result ?? "");
    },
  });

  const notebookLinking = useMutation({
    mutationFn: () => postNoteAi(note.id, "notebookLinking", aiOpts()),
    onSuccess: (d) => {
      setLastKind(null);
      setOutput(d.result ?? "");
    },
  });

  const applyRewrite = useMutation({
    mutationFn: async () => {
      if (!output?.trim()) return;
      const doc = plainTextToTipTapDoc(output);
      const preview = extractPreviewFromDoc(doc);
      await patchNote(note.id, { contentJson: doc, previewText: preview || null });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notes-app"] });
      setOutput(null);
      setLastKind(null);
      onUpdated();
    },
  });

  if (offline) {
    return embedded ? (
      <p className="text-xs text-muted-foreground">
        AI tools need the Notebooks API. Edit notes locally, then sync when the server is available.
      </p>
    ) : (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/15 p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI tools</div>
        <p className="text-xs text-muted-foreground">
          AI tools need the Notebooks API. Edit notes locally, then sync when the server is available.
        </p>
      </div>
    );
  }

  const inner = (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5"
          disabled={summarize.isPending}
          onClick={() => summarize.mutate()}
        >
          {summarize.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          Summarize
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5"
          disabled={rewrite.isPending}
          onClick={() => rewrite.mutate()}
        >
          {rewrite.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
          Rewrite
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5"
          disabled={notebookLinking.isPending}
          onClick={() => notebookLinking.mutate()}
        >
          {notebookLinking.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Link2 className="size-3.5" />
          )}
          Linking ideas
        </Button>
        {lastKind === "rewrite" && output ? (
          <Button
            type="button"
            size="sm"
            disabled={applyRewrite.isPending}
            onClick={() => applyRewrite.mutate()}
          >
            {applyRewrite.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Apply rewrite to note"}
          </Button>
        ) : null}
      </div>
      {output ? (
        <div className="max-h-52 overflow-y-auto rounded-md border border-border bg-background p-3 text-sm whitespace-pre-wrap text-foreground">
          {output}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {notesBootstrap?.ai?.backend === "ollama" ?
            <>
              Uses local <code className="rounded bg-muted px-1">Ollama</code> ({notesBootstrap.ai.chatModel}). After{" "}
              <strong>Rewrite</strong>, use <strong>Apply rewrite</strong> to replace the note body.
            </>
          : notesBootstrap?.ai?.backend === "groq" ?
            <>
              Uses <code className="rounded bg-muted px-1">Groq</code> ({notesBootstrap.ai.chatModel}) on the server.
              After <strong>Rewrite</strong>, use <strong>Apply rewrite</strong> to replace the note body.
            </>
          : notesBootstrap?.ai?.backend === "openai" ?
            <>
              Requires <code className="rounded bg-muted px-1">OPENAI_API_KEY</code> on the API. After{" "}
              <strong>Rewrite</strong>, use <strong>Apply rewrite</strong> to replace the note body.
            </>
          : <>
              Connect the API server with AI enabled (Ollama locally, Groq on Vercel, or OpenAI). After{" "}
              <strong>Rewrite</strong>, use <strong>Apply rewrite</strong> to replace the note body.
            </>}
        </p>
      )}
    </>
  );

  if (embedded) {
    return <div className="flex flex-col gap-3">{inner}</div>;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/15 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI tools</div>
      {inner}
    </div>
  );
}
