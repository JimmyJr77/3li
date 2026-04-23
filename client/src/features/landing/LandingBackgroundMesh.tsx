import { cn } from "@/lib/utils";
import { useLandingPalette } from "@/features/landing/useLandingPalette";

export function LandingBackgroundMesh() {
  const { isDark } = useLandingPalette();
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <div
        className={cn(
          "absolute inset-0 opacity-[0.35] [background-size:48px_48px]",
          isDark
            ? "bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)]"
            : "bg-[linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)]",
        )}
      />
      <div
        className={cn(
          "absolute -left-1/4 top-0 h-[min(80vh,720px)] w-[80%] rounded-full blur-3xl",
          isDark ? "bg-red-600/15" : "bg-red-500/10",
        )}
      />
      <div
        className={cn(
          "absolute -right-1/4 bottom-0 h-[min(60vh,560px)] w-[70%] rounded-full blur-3xl",
          isDark ? "bg-zinc-500/10" : "bg-zinc-400/15",
        )}
      />
    </div>
  );
}
