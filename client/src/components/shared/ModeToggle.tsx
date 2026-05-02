import { Check, Moon, Rainbow, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { startTransition, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeAccentDropdownSection } from "@/components/shared/ThemeAccentDropdownSection";
import { cn } from "@/lib/utils";

export function ModeToggle() {
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
  const showDark = mounted && !showVibrant && !showRainbow && theme === "dark";

  return (
    <DropdownMenu onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Choose color theme">
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
          <Sun
            className={cn(
              "size-4 transition-all",
              showVibrant || showRainbow || showDark ? "scale-0 opacity-0" : "scale-100 rotate-0 opacity-100",
            )}
            aria-hidden
          />
          <Moon
            className={cn(
              "absolute size-4 transition-all",
              showDark ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0",
            )}
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[13.5rem]">
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
