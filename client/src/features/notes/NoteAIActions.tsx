import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Tags, Wand2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createWorkspaceTag, patchNote, postNoteAi } from "./api";
import { extractPreviewFromDoc } from "./extractPreview";
import { plainTextToTipTapDoc } from "./noteUtils";
import type { AtlasNoteDto } from "./types";

export function NoteAIActions({
  note,
  workspaceId,
  onUpdated,
  offline,
}: {
  note: AtlasNoteDto;
  workspaceId: string;
  onUpdated: () => void;
  /** When true (browser-only storage), AI actions are unavailable */
  offline?: boolean;
}) {
  const qc = useQueryClient();
  const [output, setOutput] = useState<string | null>(null);
  const [lastKind, setLastKind] = useState<"summarize" | "rewrite" | null>(null);

  const summarize = useMutation({
    mutationFn: () => postNoteAi(note.id, "summarize"),
    onSuccess: (d) => {
      setLastKind("summarize");
      setOutput(d.result ?? "");
    },
  });

  const rewrite = useMutation({
    mutationFn: () => postNoteAi(note.id, "rewrite"),
    onSuccess: (d) => {
      setLastKind("rewrite");
      setOutput(d.result ?? "");
    },
  });

  const suggestTags = useMutation({
    mutationFn: async () => {
      const { tags = [] } = await postNoteAi(note.id, "suggestTags");
      if (!tags.length) {
        return { mode: "empty" as const };
      }
      const existing = new Map(note.tags.map((t) => [t.name.toLowerCase(), t.id]));
      const ids = new Set(note.tags.map((t) => t.id));
      for (const name of tags) {
        const key = name.toLowerCase();
        let id = existing.get(key);
        if (!id) {
          const t = await createWorkspaceTag({ workspaceId, name });
          id = t.id;
          existing.set(key, id);
        }
        ids.add(id);
      }
      await patchNote(note.id, { tagIds: [...ids] });
      return { mode: "applied" as const };
    },
    onSuccess: (res) => {
      setLastKind(null);
      if (res?.mode === "empty") {
        setOutput("No tag suggestions returned.");
        return;
      }
      setOutput("Suggested tags were applied to this note.");
      void qc.invalidateQueries({ queryKey: ["notes-app"] });
      onUpdated();
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
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/15 p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI</div>
        <p className="text-xs text-muted-foreground">
          AI actions need the Notebooks API. Edit notes locally, then sync when the server is available.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/15 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI</div>
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
          disabled={suggestTags.isPending}
          onClick={() => suggestTags.mutate()}
        >
          {suggestTags.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Tags className="size-3.5" />}
          Suggest tags
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
          Requires <code className="rounded bg-muted px-1">OPENAI_API_KEY</code> on the API. After <strong>Rewrite</strong>,
          use <strong>Apply rewrite</strong> to replace the note body.
        </p>
      )}
    </div>
  );
}
