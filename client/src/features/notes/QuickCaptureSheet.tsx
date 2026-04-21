import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createNote } from "./api";
import { extractPreviewFromDoc } from "./extractPreview";
import { plainTextToTipTapDoc } from "./noteUtils";

export function QuickCaptureSheet({
  open,
  onOpenChange,
  workspaceId,
  folderId,
  onCreated,
  createNoteFn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  folderId: string;
  onCreated?: (noteId: string) => void;
  /** Browser-only mode: create without calling the API */
  createNoteFn?: (body: {
    workspaceId: string;
    folderId: string;
    title: string;
    contentJson: unknown;
    previewText: string | null;
  }) => Promise<{ id: string }>;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const doc = plainTextToTipTapDoc(body);
      const preview = extractPreviewFromDoc(doc);
      const payload = {
        workspaceId,
        folderId,
        title: title.trim() || "Quick note",
        contentJson: doc,
        previewText: preview || null,
      };
      if (createNoteFn) return createNoteFn(payload);
      return createNote(payload);
    },
    onSuccess: (note) => {
      setTitle("");
      setBody("");
      onOpenChange(false);
      onCreated?.(note.id);
      if (!createNoteFn) void qc.invalidateQueries({ queryKey: ["notes-app"] });
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Quick capture</SheetTitle>
          <SheetDescription>Jot a title and body. Saves as a new note in the current folder context.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qc-title">Title</Label>
            <Input
              id="qc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Idea or meeting…"
              className="h-9"
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="qc-body">Note</Label>
            <textarea
              id="qc-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write freely — each line becomes a paragraph."
              rows={12}
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-[200px] w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            />
          </div>
        </div>
        <SheetFooter className="gap-2 border-t border-border px-4 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save note"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
