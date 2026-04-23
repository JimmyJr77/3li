import { Check, Copy, Globe } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { patchNote } from "./api";
import { slugifyForPublicUrl } from "./slug";
import type { AtlasNoteDto } from "./types";

export function NotePublishingBar({
  note,
  onUpdated,
  offline,
  embedded,
}: {
  note: AtlasNoteDto;
  onUpdated: () => void;
  /** When true (browser-only storage), public links are not available */
  offline?: boolean;
  /** Omit outer card chrome when nested inside a larger panel */
  embedded?: boolean;
}) {
  const [isPublic, setIsPublic] = useState(note.isPublic);
  const [slugDraft, setSlugDraft] = useState(note.publicSlug ?? "");
  const [copied, setCopied] = useState(false);

  const apply = async (nextPublic: boolean, nextSlug: string) => {
    await patchNote(note.id, {
      isPublic: nextPublic,
      publicSlug: nextSlug.trim() === "" ? null : slugifyForPublicUrl(nextSlug),
    });
    onUpdated();
  };

  const publicPath = slugDraft.trim() ? `/n/${slugifyForPublicUrl(slugDraft)}` : "";
  const fullUrl =
    typeof window !== "undefined" && publicPath ? `${window.location.origin}${publicPath}` : "";

  const offlineShell = embedded
    ? "flex flex-col gap-2"
    : "flex flex-col gap-2 rounded-lg border border-border bg-muted/15 p-3";
  const onlineShell = embedded
    ? "flex flex-col gap-3"
    : "flex flex-col gap-3 rounded-lg border border-border bg-muted/15 p-3";

  if (offline) {
    return (
      <div className={offlineShell}>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Globe className="size-3.5" />
          Publish
        </div>
        <p className="text-xs text-muted-foreground">
          Public links require the Notebooks API. Notes in this session stay in your browser only.
        </p>
      </div>
    );
  }

  return (
    <div className={onlineShell}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Globe className="size-3.5" />
        Publish
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border-input"
            checked={isPublic}
            onChange={async (e) => {
              const v = e.target.checked;
              setIsPublic(v);
              let slug = slugDraft;
              if (v && !slug.trim()) {
                slug = slugifyForPublicUrl(note.title || "note");
                setSlugDraft(slug);
              }
              await apply(v, slug);
            }}
          />
          Public link
        </label>
        <div className="flex min-w-[12rem] max-w-md flex-1 flex-col gap-1">
          <Label htmlFor="pub-slug" className="text-xs text-muted-foreground">
            URL slug
          </Label>
          <Input
            id="pub-slug"
            value={slugDraft}
            onChange={(e) => setSlugDraft(e.target.value)}
            onBlur={async () => {
              const normalized = slugDraft.trim() === "" ? "" : slugifyForPublicUrl(slugDraft);
              setSlugDraft(normalized);
              if (normalized !== (note.publicSlug ?? "") || isPublic !== note.isPublic) {
                await apply(isPublic, normalized);
              }
            }}
            placeholder={slugifyForPublicUrl(note.title || "my-note")}
            className="h-8 font-mono text-sm"
            disabled={!isPublic}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5"
          disabled={!isPublic || !slugDraft.trim()}
          onClick={async () => {
            if (!fullUrl) return;
            await navigator.clipboard.writeText(fullUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      {isPublic && fullUrl ? (
        <p className="break-all text-xs text-muted-foreground">
          Anyone with the link can read this note (read-only).
          <span className="mt-1 block font-mono text-[0.7rem] text-foreground/80">{fullUrl}</span>
        </p>
      ) : null}
    </div>
  );
}
