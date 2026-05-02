import { Check } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ACCENT_LABELS,
  ACCENT_PALETTE_IDS,
  ACCENT_SWATCH_GRADIENT,
  getAccentPalette,
  setAccentPalette,
  type AccentPaletteId,
} from "@/lib/accentPalette";

type Props = {
  /** When the parent dropdown opens, re-read accent from storage (e.g. after changing it in Settings). */
  menuOpen: boolean;
};

/** Primary / accent color rows for theme dropdowns (workspace + public header). */
export function ThemeAccentDropdownSection({ menuOpen }: Props) {
  const [mounted, setMounted] = useState(false);
  const [accent, setAccent] = useState<AccentPaletteId>("default");

  useEffect(() => {
    startTransition(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!mounted || !menuOpen) return;
    setAccent(getAccentPalette());
  }, [mounted, menuOpen]);

  const pick = (id: AccentPaletteId) => {
    setAccentPalette(id);
    setAccent(id);
  };

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        Primary color
      </DropdownMenuLabel>
      {ACCENT_PALETTE_IDS.map((id) => (
        <DropdownMenuItem
          key={id}
          disabled={!mounted}
          className="gap-2 pl-2"
          onClick={() => pick(id)}
        >
          <span
            className="size-3.5 shrink-0 rounded-full border border-border shadow-sm"
            style={{ background: ACCENT_SWATCH_GRADIENT[id] }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">{ACCENT_LABELS[id]}</span>
          <Check className={cn("size-3.5 shrink-0 opacity-0", accent === id && "opacity-80")} aria-hidden />
        </DropdownMenuItem>
      ))}
    </>
  );
}
