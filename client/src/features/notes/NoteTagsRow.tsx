import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createWorkspaceTag, fetchWorkspaceTags, patchNote, type PatchNoteBody } from "./api";
import type { AtlasNoteDto, NoteTagDto } from "./types";

export function NoteTagsRow({
  note,
  workspaceId,
  allTags: allTagsOverride,
  patchNoteFn,
  createTagFn,
  onAfterChange,
}: {
  note: AtlasNoteDto;
  workspaceId: string;
  /** When provided (browser-only mode), skips GET /tags */
  allTags?: NoteTagDto[];
  patchNoteFn?: (id: string, body: PatchNoteBody) => Promise<AtlasNoteDto>;
  createTagFn?: (body: { workspaceId: string; name: string; color?: string }) => Promise<NoteTagDto>;
  onAfterChange?: () => void;
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

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tags</div>
      {loadingTags ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((t) => {
            const on = tagIds.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => !updateTags.isPending && toggle(t.id)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  on
                    ? "border-transparent text-white"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
                style={on ? { backgroundColor: t.color } : undefined}
              >
                {t.name}
              </button>
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
