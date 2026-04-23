import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createWorkspaceTag,
  deleteWorkspaceTag,
  fetchWorkspaceTags,
  patchNote,
  postNoteMailClerkAutotag,
  type PatchNoteBody,
} from "./api";
import type { AtlasNoteDto, NoteTagDto } from "./types";

export function NoteTagsRow({
  note,
  workspaceId,
  allTags: allTagsOverride,
  patchNoteFn,
  createTagFn,
  deleteTagFn,
  onAfterChange,
  mailClerkAutotagUnavailable,
}: {
  note: AtlasNoteDto;
  workspaceId: string;
  /** When provided (browser-only mode), skips GET /tags */
  allTags?: NoteTagDto[];
  patchNoteFn?: (id: string, body: PatchNoteBody) => Promise<AtlasNoteDto>;
  createTagFn?: (body: { workspaceId: string; name: string; color?: string }) => Promise<NoteTagDto>;
  /** When provided (browser-only mode), deletes from local store instead of the API. */
  deleteTagFn?: (tagId: string) => Promise<void>;
  onAfterChange?: () => void;
  /** When true, hides Mail Clerk autotag (e.g. browser-only notes — needs API). */
  mailClerkAutotagUnavailable?: boolean;
}) {
  const qc = useQueryClient();
  const { data: remoteTags = [], isLoading } = useQuery({
    queryKey: ["notes-app", "tags", workspaceId],
    queryFn: () => fetchWorkspaceTags(workspaceId),
    enabled: allTagsOverride === undefined,
  });
  const allTags = allTagsOverride ?? remoteTags;
  const loadingTags = allTagsOverride !== undefined ? false : isLoading;

  const [newTag, setNewTag] = useState("");
  const tagIds = new Set(note.tags.map((t) => t.id));

  const doPatch = patchNoteFn ?? ((id: string, body: PatchNoteBody) => patchNote(id, body));
  const doCreateTag = createTagFn ?? ((body: { workspaceId: string; name: string; color?: string }) => createWorkspaceTag(body));
  const doDeleteTag = deleteTagFn ?? ((tagId: string) => deleteWorkspaceTag(workspaceId, tagId));

  const updateTags = useMutation({
    mutationFn: async (nextIds: string[]) => {
      return doPatch(note.id, { tagIds: nextIds });
    },
    onSuccess: () => {
      onAfterChange?.();
      void qc.invalidateQueries({ queryKey: ["notes-app"] });
    },
  });

  const toggle = (id: string) => {
    const next = new Set(tagIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateTags.mutate([...next]);
  };

  const addNewTag = useMutation({
    mutationFn: async (name: string) => {
      const tag = await doCreateTag({ workspaceId, name });
      const nextIds = [...new Set([...tagIds, tag.id])];
      return doPatch(note.id, { tagIds: nextIds });
    },
    onSuccess: () => {
      setNewTag("");
      onAfterChange?.();
      void qc.invalidateQueries({ queryKey: ["notes-app"] });
    },
  });

  const removeTag = useMutation({
    mutationFn: (tagId: string) => doDeleteTag(tagId),
    onSuccess: () => {
      onAfterChange?.();
      void qc.invalidateQueries({ queryKey: ["notes-app"] });
    },
  });

  const mailClerkAutotag = useMutation({
    mutationFn: () => postNoteMailClerkAutotag(note.id),
    onSuccess: () => {
      onAfterChange?.();
      void qc.invalidateQueries({ queryKey: ["notes-app"] });
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { status?: number; data?: { detail?: string; error?: string } } };
      const d = ax.response?.data?.detail ?? ax.response?.data?.error;
      if (ax.response?.status === 409) {
        window.alert(d ?? "Create at least one workspace tag before using autotag.");
        return;
      }
      window.alert(d ?? "Mail Clerk autotag failed. Check AI configuration and try again.");
    },
  });

  const busy = updateTags.isPending || addNewTag.isPending || removeTag.isPending || mailClerkAutotag.isPending;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tags</div>
        {!mailClerkAutotagUnavailable ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 shrink-0 gap-1 text-xs"
            disabled={busy || !allTags.length}
            title="Mail Clerk: suggest tags from your workspace vocabulary using notebooks, boards, and recent activity as context."
            onClick={() => mailClerkAutotag.mutate()}
          >
            {mailClerkAutotag.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            Autotag
          </Button>
        ) : null}
      </div>
      {loadingTags ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((t) => {
            const on = tagIds.has(t.id);
            return (
              <div
                key={t.id}
                className={cn(
                  "inline-flex items-stretch overflow-hidden rounded-full border text-xs font-medium transition-colors",
                  on ? "border-transparent" : "border-border bg-background text-muted-foreground",
                )}
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => !busy && toggle(t.id)}
                  className={cn(
                    "px-2.5 py-0.5 transition-colors",
                    on ? "text-white" : "hover:bg-muted",
                  )}
                  style={on ? { backgroundColor: t.color } : undefined}
                >
                  {t.name}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  title={`Remove “${t.name}” from this workspace`}
                  aria-label={`Delete tag ${t.name} from workspace`}
                  className="border-border text-muted-foreground hover:bg-destructive/15 hover:text-destructive flex items-center border-l px-1.5 disabled:opacity-50"
                  onClick={() => {
                    if (busy) return;
                    if (window.confirm(`Delete tag “${t.name}” from this workspace? It will be removed from all notes.`)) {
                      removeTag.mutate(t.id);
                    }
                  }}
                >
                  <Trash2 className="size-3 shrink-0" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newTag.trim();
          if (!name || addNewTag.isPending) return;
          addNewTag.mutate(name);
        }}
      >
        <Input
          placeholder="New tag…"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          className="h-8 text-sm"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={!newTag.trim() || addNewTag.isPending}>
          Add
        </Button>
      </form>
    </div>
  );
}
