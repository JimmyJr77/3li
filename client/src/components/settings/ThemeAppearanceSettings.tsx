import { useTheme } from "next-themes";
import { startTransition, useEffect, useState } from "react";
import { Check, Palette, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ACCENT_LABELS,
  ACCENT_PALETTE_IDS,
  ACCENT_SWATCH_GRADIENT,
  applyAccentPaletteToDocument,
  getAccentPalette,
  setAccentPalette,
  type AccentPaletteId,
} from "@/lib/accentPalette";
import type { WorkspaceColorTheme } from "@/lib/themeIds";
import { WORKSPACE_COLOR_THEMES } from "@/lib/themeIds";

const MODE_OPTIONS: { id: WorkspaceColorTheme; label: string; hint: string }[] = [
  { id: "light", label: "Light", hint: "Cool daylight surfaces and clear hierarchy." },
  { id: "vibrant", label: "Vibrant", hint: "Graduated field with saturated chrome on rails and sidebars." },
  { id: "dark", label: "Dark", hint: "Low-light workspace with bright accents." },
  { id: "rainbow-explosion", label: "Rainbow", hint: "Playful multi-hue cards; accent palette has little effect here." },
];

function isWorkspaceMode(id: string): id is WorkspaceColorTheme {
  return (WORKSPACE_COLOR_THEMES as readonly string[]).includes(id);
}

export function ThemeAppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [accent, setAccent] = useState<AccentPaletteId>("default");

  useEffect(() => {
    startTransition(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setAccent(getAccentPalette());
  }, [mounted, theme]);

  const activeMode: WorkspaceColorTheme | null =
    mounted && theme && isWorkspaceMode(theme) ? theme : null;

  const pickMode = (id: WorkspaceColorTheme) => {
    setTheme(id);
    if (id === "rainbow-explosion") {
      setAccentPalette("default");
      setAccent("default");
    }
  };

  const pickAccent = (id: AccentPaletteId) => {
    setAccentPalette(id);
    applyAccentPaletteToDocument(id);
    setAccent(id);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 opacity-70" aria-hidden />
            Theme mode
          </CardTitle>
          <CardDescription>
            Light, Vibrant, and Dark keep the same layout and contrast rules; Rainbow is a separate experimental look.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => pickMode(opt.id)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors",
                activeMode != null && activeMode === opt.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/25"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <span className="text-sm font-medium text-foreground">{opt.label}</span>
              <span className="text-xs text-muted-foreground">{opt.hint}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4 opacity-70" aria-hidden />
            Primary color
          </CardTitle>
          <CardDescription>
            Retints buttons, rings, sidebar chrome, and vibrant washes. Ice uses neutral glass and grayscale chrome.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Default matches the original blue reference. Other palettes follow the same structure in Light, Vibrant, or
            Dark.
          </p>
          <div className="flex flex-wrap gap-2">
            {ACCENT_PALETTE_IDS.map((id) => (
              <Button
                key={id}
                type="button"
                variant={accent === id ? "default" : "outline"}
                size="sm"
                className="gap-2 pr-3"
                onClick={() => pickAccent(id)}
                disabled={!mounted}
              >
                <span
                  className="size-4 shrink-0 rounded-full border border-border shadow-sm"
                  style={{ background: ACCENT_SWATCH_GRADIENT[id] }}
                  aria-hidden
                />
                <span className="max-w-[10rem] truncate">{ACCENT_LABELS[id]}</span>
                {accent === id ? <Check className="size-3.5 shrink-0 opacity-80" aria-hidden /> : null}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
