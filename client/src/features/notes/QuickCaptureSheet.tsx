import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { RightAppSheetResizeHandle, useResizableRightAppSheetWidth, rightAppSheetContentClassName } from "@/hooks/useResizableRightAppSheetWidth";
import { cn } from "@/lib/utils";
import { getBrandContextForAI } from "@/features/brand/brandKitContext";
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
import { createNote, enrichQuickCapture } from "./api";
import { extractPreviewFromDoc } from "./extractPreview";
import { plainTextToTipTapDoc } from "./noteUtils";

export function QuickCaptureSheet({
  open,
  onOpenChange,
  workspaceId,
  folderId,
  onCreated,
  createNoteFn,
  aiDisabled = false,
  contextSummary,
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
  /** When true (e.g. offline local notes), AI refine is unavailable */
  aiDisabled?: boolean;
  /** Shown as context hint — server still loads workspace + notebook by id */
  contextSummary?: string;
}) {
  const qc = useQueryClient();
  const { startResize, sheetWidthStyle } = useResizableRightAppSheetWidth({ open });
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

  const enrich = useMutation({
    mutationFn: async () => {
      const brandCenterContext = await getBrandContextForAI(workspaceId, 12_000);
      return enrichQuickCapture({
        workspaceId,
        folderId,
        title: title.trim(),
        rawText: body,
        brandCenterContext,
      });
    },
    onSuccess: (data) => {
      setTitle(data.title);
      setBody(data.body);
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string; detail?: string } } };
      const msg =
        ax.response?.data?.detail ||
        ax.response?.data?.error ||
        (e instanceof Error ? e.message : null) ||
        "Could not refine note";
      window.alert(msg);
    },
  });

  const canRefine = !aiDisabled && body.trim().length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(rightAppSheetContentClassName, "overflow-y-auto")}
        style={sheetWidthStyle}
      >
        <RightAppSheetResizeHandle onMouseDown={startResize} />
        <SheetHeader className="p-4 pl-10 sm:pl-12">
          <SheetTitle>Quick capture</SheetTitle>
          <SheetDescription>
            Jot a title and body. Saves into the <span className="font-medium text-foreground">Quicknotes</span>{" "}
            notebook. Use{" "}
            <span className="font-medium text-foreground">Refine with AI</span> to tighten copy using your saved{" "}
            <a href="/app/brand-center" className="font-medium text-foreground underline underline-offset-2">
              Brand Center
            </a>{" "}
            kit for this workspace, plus optional quick snippets from Rapid Router on this device.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-2 pl-10 sm:pl-12">
          {contextSummary ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/90">Saving into:</span> {contextSummary}
            </p>
          ) : null}
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
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="qc-body">Note</Label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 gap-1.5"
                disabled={!canRefine || enrich.isPending}
                title={
                  aiDisabled
                    ? "Connect to the notes server to use AI"
                    : !body.trim()
                      ? "Add note text first"
                      : "Rewrite with workspace, notebook & Brand Center context"
                }
                onClick={() => enrich.mutate()}
              >
                {enrich.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden />
                )}
                Refine with AI
              </Button>
            </div>
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
        <SheetFooter className="gap-2 border-t border-border px-4 py-4 pl-10 sm:flex-row sm:justify-end sm:pl-12">
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
