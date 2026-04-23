import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useLandingPalette } from "@/features/landing/useLandingPalette";

export function LandingCursorGlow() {
  const { isDark } = useLandingPalette();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [on, setOn] = useState(false);

  const move = useCallback((e: PointerEvent) => {
    setPos({ x: e.clientX, y: e.clientY });
    setOn(true);
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [move]);

  if (!on) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-[15]",
        isDark ? "mix-blend-screen" : "mix-blend-multiply opacity-70",
      )}
      style={{
        background: isDark
          ? `radial-gradient(520px circle at ${pos.x}px ${pos.y}px, oklch(0.62 0.24 25 / 0.12), transparent 55%)`
          : `radial-gradient(520px circle at ${pos.x}px ${pos.y}px, oklch(0.55 0.22 25 / 0.08), transparent 55%)`,
      }}
      aria-hidden
    />
  );
}
