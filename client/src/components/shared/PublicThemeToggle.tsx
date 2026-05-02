import { Check, Moon, Rainbow, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { startTransition, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeAccentDropdownSection } from "@/components/shared/ThemeAccentDropdownSection";
import { cn } from "@/lib/utils";

/** Site (red zinc) + same app color themes as the workspace chrome. */
export function PublicThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setMounted(true);
    });
  }, []);

  const showVibrant = mounted && theme === "vibrant";
  const showRainbow = mounted && theme === "rainbow-explosion";
  const showWorkspaceDark = mounted && !showVibrant && !showRainbow && theme === "dark";
  const showWorkspaceLight = mounted && theme === "light";
  const showRedDark = mounted && theme === "public-red-dark";
  const showRedLight = mounted && theme === "public-red-light";

  const FallbackIcon = !mounted ? Moon : Sun;

  return (
    <DropdownMenu onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Choose site or app color theme">
          <span className="relative block size-4">
            <Rainbow
              className={cn(
                "absolute size-4 transition-all",
                showRainbow ? "scale-100 rotate-0 text-primary opacity-100" : "scale-0 opacity-0",
              )}
              aria-hidden
            />
            <Sparkles
              className={cn(
                "absolute size-4 transition-all",
                showVibrant ? "scale-100 rotate-0 text-primary opacity-100" : "scale-0 opacity-0",
              )}
              aria-hidden
            />
            <Moon
              className={cn(
                "absolute size-4 transition-all",
                showWorkspaceDark || showRedDark ? "scale-100 rotate-0 opacity-100" : "scale-0 opacity-0",
              )}
              aria-hidden
            />
            <Sun
              className={cn(
                "absolute size-4 transition-all",
                showWorkspaceLight || showRedLight ? "scale-100 rotate-0 opacity-100" : "scale-0 opacity-0",
              )}
              aria-hidden
            />
            <FallbackIcon
              className={cn(
                "size-4 transition-all",
                (showRainbow ||
                  showVibrant ||
                  showWorkspaceDark ||
                  showRedDark ||
                  showWorkspaceLight ||
                  showRedLight) &&
                  "scale-0 opacity-0",
                !mounted && "opacity-50",
              )}
              aria-hidden
            />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[13.5rem]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Site (red marketing)</DropdownMenuLabel>
        <DropdownMenuItem className="gap-2 pl-2" onClick={() => setTheme("public-red-light")}>
          <span className="min-w-0 flex-1 truncate">Red Light</span>
          <Check
            className={cn(
              "size-3.5 shrink-0 opacity-0",
              mounted && theme === "public-red-light" && "opacity-80",
            )}
            aria-hidden
          />
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 pl-2" onClick={() => setTheme("public-red-dark")}>
          <span className="min-w-0 flex-1 truncate">Red Dark</span>
          <Check
            className={cn(
              "size-3.5 shrink-0 opacity-0",
              mounted && theme === "public-red-dark" && "opacity-80",
            )}
            aria-hidden
          />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">App themes</DropdownMenuLabel>
        <DropdownMenuItem className="gap-2 pl-2" onClick={() => setTheme("light")}>
          <span className="min-w-0 flex-1 truncate">Light theme</span>
          <Check
            className={cn("size-3.5 shrink-0 opacity-0", mounted && theme === "light" && "opacity-80")}
            aria-hidden
          />
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 pl-2" onClick={() => setTheme("vibrant")}>
          <span className="min-w-0 flex-1 truncate">Vibrant theme</span>
          <Check
            className={cn("size-3.5 shrink-0 opacity-0", mounted && theme === "vibrant" && "opacity-80")}
            aria-hidden
          />
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 pl-2" onClick={() => setTheme("dark")}>
          <span className="min-w-0 flex-1 truncate">Dark theme</span>
          <Check
            className={cn("size-3.5 shrink-0 opacity-0", mounted && theme === "dark" && "opacity-80")}
            aria-hidden
          />
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 pl-2" onClick={() => setTheme("rainbow-explosion")}>
          <span className="min-w-0 flex-1 truncate">Rainbow Explosion</span>
          <Check
            className={cn(
              "size-3.5 shrink-0 opacity-0",
              mounted && theme === "rainbow-explosion" && "opacity-80",
            )}
            aria-hidden
          />
        </DropdownMenuItem>
        <ThemeAccentDropdownSection menuOpen={menuOpen} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
