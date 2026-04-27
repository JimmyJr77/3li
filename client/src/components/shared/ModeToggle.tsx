import { Moon, Rainbow, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { startTransition, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ModeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setMounted(true);
    });
  }, []);

  const showVibrant = mounted && (theme === "vibrant" || theme === "vibrant-red");
  const showRainbow = mounted && theme === "rainbow-explosion";
  const showDark = mounted && !showVibrant && !showRainbow && (theme === "dark" || theme === "dark-red");

  return (
    <DropdownMenu>
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
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>Light (Blue)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("light-red")}>Light (Red)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark (Blue)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark-red")}>Dark (Red)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("vibrant")}>Vibrant (Blue)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("vibrant-red")}>Vibrant (Red)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("rainbow-explosion")}>Rainbow Explosion</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
