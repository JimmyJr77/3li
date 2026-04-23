import { Monitor, Moon, Rainbow, Sparkles, Sun } from "lucide-react";
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
import { cn } from "@/lib/utils";

/** Site (red zinc) + same app color themes as the workspace chrome. */
export function PublicThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

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
  const showSystem = mounted && theme === "system";

  const FallbackIcon = !mounted ? Moon : Sun;

  return (
    <DropdownMenu>
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
            <Monitor
              className={cn(
                "absolute size-4 transition-all",
                showSystem ? "scale-100 rotate-0 opacity-100" : "scale-0 opacity-0",
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
                  showRedLight ||
                  showSystem) &&
                  "scale-0 opacity-0",
                !mounted && "opacity-50",
              )}
              aria-hidden
            />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Site (red marketing)</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("public-red-light")}>Red Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("public-red-dark")}>Red Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">App themes</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("vibrant")}>Vibrant</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("rainbow-explosion")}>Rainbow Explosion</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
