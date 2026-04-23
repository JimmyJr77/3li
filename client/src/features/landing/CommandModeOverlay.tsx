import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLandingPalette } from "@/features/landing/useLandingPalette";
import { cn } from "@/lib/utils";

export function CommandModeOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isDark } = useLandingPalette();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            aria-label="Close command mode"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-mode-title"
            className={cn(
              "relative z-10 flex h-[min(92vh,720px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border shadow-2xl",
              isDark
                ? "border-white/10 bg-zinc-950/95 text-zinc-200 shadow-black/60"
                : "border-zinc-900/10 bg-white/95 text-zinc-800 shadow-zinc-900/20",
            )}
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <header
              className={cn(
                "flex items-center justify-between border-b px-4 py-3 sm:px-5",
                isDark ? "border-white/10" : "border-zinc-900/10",
              )}
            >
              <div>
                <p id="command-mode-title" className="text-sm font-semibold tracking-tight text-red-500">
                  Command mode
                </p>
                <p className={cn("text-xs", isDark ? "text-zinc-500" : "text-zinc-500")}>Preview environment — not connected to your workspace</p>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => onOpenChange(false)} aria-label="Close">
                <X className="size-4" />
              </Button>
            </header>

            <div className="flex min-h-0 flex-1">
              <aside
                className={cn(
                  "hidden w-44 shrink-0 flex-col gap-1 border-r p-3 sm:flex",
                  isDark ? "border-white/10 bg-black/30" : "border-zinc-900/10 bg-zinc-50/80",
                )}
              >
                {["Overview", "Objectives", "Plans", "Boards", "Notes", "AI"].map((item) => (
                  <span
                    key={item}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-xs font-medium",
                      item === "Overview"
                        ? "bg-red-600/20 text-red-400"
                        : isDark
                          ? "text-zinc-500 hover:bg-white/5"
                          : "text-zinc-600 hover:bg-zinc-900/5",
                    )}
                  >
                    {item}
                  </span>
                ))}
              </aside>
              <div className="flex min-w-0 flex-1 flex-col">
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-2 border-b px-4 py-2 sm:px-5",
                    isDark ? "border-white/10" : "border-zinc-900/10",
                  )}
                >
                  <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-500">
                    Live
                  </span>
                  <span className={cn("text-xs", isDark ? "text-zinc-500" : "text-zinc-500")}>Workspace · North America</span>
                  <span className={cn("ml-auto hidden text-xs sm:inline", isDark ? "text-zinc-600" : "text-zinc-500")}>
                    Esc to close
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
                  <div className={cn("font-mono text-xs sm:text-sm", isDark ? "text-zinc-400" : "text-zinc-600")}>
                    <p className="text-red-500">3li&gt;</p>
                    <p className="mt-2">load context — strategy — execution graph</p>
                    <p className="mt-1 opacity-80">status: aligned · owners mapped · next moves queued</p>
                    <p className="mt-4 text-zinc-500">// This is the discipline layer. Tools follow.</p>
                  </div>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    <div className={cn("rounded-xl border p-4", isDark ? "border-white/10 bg-white/[0.04]" : "border-zinc-200 bg-zinc-50")}>
                      <p className="text-xs font-bold uppercase tracking-wide text-red-500">Inbox</p>
                      <p className={cn("mt-2 text-sm", isDark ? "text-zinc-300" : "text-zinc-700")}>Route capture to the right surface. No lost threads.</p>
                    </div>
                    <div className={cn("rounded-xl border p-4", isDark ? "border-white/10 bg-white/[0.04]" : "border-zinc-200 bg-zinc-50")}>
                      <p className="text-xs font-bold uppercase tracking-wide text-red-500">Next</p>
                      <p className={cn("mt-2 text-sm", isDark ? "text-zinc-300" : "text-zinc-700")}>Three decisions. Two handoffs. One owner each.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
