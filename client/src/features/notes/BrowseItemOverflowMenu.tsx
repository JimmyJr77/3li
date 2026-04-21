import { MoreVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ROW_ACCENT_PRESET_HEX, isValidRowAccentHex } from "./notebookRowAccent";

type BrowseItemOverflowMenuProps = {
  kind: "notebook" | "note";
  initialTitle: string;
  initialAccent: string | null;
  onApply: (payload: { title: string; rowAccentColor: string | null }) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  deleteConfirmation: string;
};

export function BrowseItemOverflowMenu({
  kind,
  initialTitle,
  initialAccent,
  onApply,
  onDelete,
  deleteConfirmation,
}: BrowseItemOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [accent, setAccent] = useState<string | null>(initialAccent ?? null);
  const [customHex, setCustomHex] = useState(() =>
    initialAccent && !(ROW_ACCENT_PRESET_HEX as readonly string[]).includes(initialAccent) ? initialAccent : "#6366f1",
  );
  const [hexError, setHexError] = useState<string | null>(null);

  const openDialog = () => {
    setTitle(initialTitle);
    setAccent(initialAccent ?? null);
    const isPreset = initialAccent && (ROW_ACCENT_PRESET_HEX as readonly string[]).includes(initialAccent);
    setCustomHex(isPreset || !initialAccent ? "#6366f1" : initialAccent);
    setHexError(null);
    setOpen(true);
  };

  const titleLabel = kind === "notebook" ? "Notebook title" : "Note title";
  const dialogTitle = kind === "notebook" ? "Notebook" : "Note";

  const applyCustomHex = (raw: string) => {
    const t = raw.trim();
    if (t === "") {
      setHexError(null);
      return;
    }
    const withHash = t.startsWith("#") ? t : `#${t}`;
    if (!isValidRowAccentHex(withHash)) {
      setHexError("Use #RRGGBB (e.g. #6366f1)");
      return;
    }
    setHexError(null);
    setAccent(withHash.toLowerCase());
  };

  const handleSave = async () => {
    const t = title.trim();
    if (!t) return;
    await onApply({ title: t, rowAccentColor: accent });
    setOpen(false);
  };

  const handleDelete = async () => {
    if (!confirm(deleteConfirmation)) return;
    await onDelete();
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="size-7 shrink-0"
        aria-label={`${dialogTitle} options`}
        title={`${dialogTitle} options`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openDialog();
        }}
      >
        <MoreVertical className="size-3.5" aria-hidden />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md" showCloseButton>
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base">{dialogTitle} options</DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            Rename, tint this row, or remove {kind === "notebook" ? "the notebook" : "the note"}.
          </DialogDescription>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label htmlFor={`browse-item-title-${kind}`}>{titleLabel}</Label>
            <Input
              id={`browse-item-title-${kind}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9"
              onKeyDown={(e) => e.key === "Enter" && void handleSave()}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Row color</p>
            <p className="text-xs text-muted-foreground">Default uses the theme. Presets work across light, dark, and vibrant themes.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                title="Default"
                onClick={() => setAccent(null)}
                className={cn(
                  "size-8 rounded-md border-2 transition-transform hover:scale-105",
                  accent == null ? "border-primary ring-2 ring-primary/30" : "border-border bg-muted",
                )}
              />
              {ROW_ACCENT_PRESET_HEX.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  title={hex}
                  onClick={() => setAccent(hex)}
                  className={cn(
                    "size-8 rounded-md border-2 transition-transform hover:scale-105",
                    accent === hex ? "border-primary ring-2 ring-primary/30" : "border-transparent",
                  )}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`browse-custom-hex-${kind}`}>Custom (#RRGGBB)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                className="h-9 w-12 cursor-pointer rounded border border-border bg-background p-0.5"
                value={accent && isValidRowAccentHex(accent) ? accent : customHex}
                onChange={(e) => {
                  setAccent(e.target.value.toLowerCase());
                  setCustomHex(e.target.value.toLowerCase());
                  setHexError(null);
                }}
                aria-label="Pick a custom color"
              />
              <Input
                id={`browse-custom-hex-${kind}`}
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                onBlur={() => applyCustomHex(customHex)}
                onKeyDown={(e) => e.key === "Enter" && applyCustomHex(customHex)}
                placeholder="#6366f1"
                className="h-9 min-w-[7rem] flex-1 font-mono text-sm"
                spellCheck={false}
              />
            </div>
            {hexError ? <p className="text-xs text-destructive">{hexError}</p> : null}
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => void handleDelete()}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </Button>
            <Button type="button" size="sm" onClick={() => void handleSave()} disabled={!title.trim()}>
              Save changes
            </Button>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
}
