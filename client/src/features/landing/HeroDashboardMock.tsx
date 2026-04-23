import { motion } from "framer-motion";
import { Bot, CheckSquare, FileText, LayoutGrid, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLandingPalette } from "@/features/landing/useLandingPalette";

const float = {
  animate: { y: [0, -4, 0] },
  transition: { duration: 5, repeat: Infinity, ease: "easeInOut" as const },
};

export function HeroDashboardMock() {
  const { isDark } = useLandingPalette();
  const chrome = isDark
    ? "border-white/10 bg-zinc-900/80 text-zinc-200"
    : "border-zinc-900/10 bg-white/90 text-zinc-800";

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl",
        isDark ? "border-white/10 bg-white/[0.04] shadow-black/50" : "border-zinc-900/10 bg-white/80 shadow-zinc-900/20",
      )}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={cn("flex items-center gap-2 border-b px-3 py-2", isDark ? "border-white/10" : "border-zinc-900/10")}>
        <span className="size-2.5 rounded-full bg-red-500/90" />
        <span className={cn("size-2.5 rounded-full", isDark ? "bg-zinc-600" : "bg-zinc-300")} />
        <span className={cn("size-2.5 rounded-full", isDark ? "bg-zinc-700" : "bg-zinc-200")} />
        <span className={cn("ml-2 font-mono text-[10px] tracking-wide", isDark ? "text-zinc-500" : "text-zinc-500")}>
          command.3li — workspace
        </span>
      </div>

      <div className="flex min-h-[320px] flex-col sm:min-h-[380px] lg:min-h-[420px]">
        <div className="flex flex-1 flex-col gap-2 p-2 sm:flex-row sm:gap-3 sm:p-3">
          {/* Sidebar */}
          <aside
            className={cn(
              "flex shrink-0 flex-row gap-1 rounded-xl border p-2 sm:w-14 sm:flex-col sm:gap-2",
              chrome,
            )}
          >
            <LayoutGrid className="size-4 text-red-500" />
            <CheckSquare className={cn("size-4", isDark ? "text-zinc-500" : "text-zinc-400")} />
            <FileText className={cn("size-4", isDark ? "text-zinc-500" : "text-zinc-400")} />
            <Bot className={cn("size-4", isDark ? "text-zinc-500" : "text-zinc-400")} />
          </aside>

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-12 sm:gap-3">
            {/* Task board */}
            <motion.div
              className={cn("col-span-2 flex flex-col rounded-xl border p-3 sm:col-span-5", chrome)}
              {...float}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-500">Tasks</span>
                <span className={cn("text-[10px]", isDark ? "text-zinc-500" : "text-zinc-500")}>Board</span>
              </div>
              <div className="grid flex-1 grid-cols-3 gap-1.5">
                {["Backlog", "Active", "Done"].map((col, i) => (
                  <div key={col} className={cn("rounded-lg border p-1.5", isDark ? "border-white/5 bg-black/20" : "border-zinc-900/5 bg-zinc-50")}>
                    <p className={cn("mb-1.5 text-[9px] font-medium uppercase", isDark ? "text-zinc-500" : "text-zinc-500")}>{col}</p>
                    {[0, 1].map((j) => (
                      <div
                        key={j}
                        className={cn(
                          "mb-1 h-6 rounded border text-[9px] leading-6",
                          i === j % 3
                            ? "border-red-500/40 bg-red-500/10"
                            : isDark
                              ? "border-white/5 bg-white/5"
                              : "border-zinc-200 bg-white",
                        )}
                      >
                        <span className="px-1.5">{i === 0 ? "Scope" : i === 1 ? "Ship" : "Win"}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Strategy */}
            <motion.div
              className={cn("col-span-2 flex flex-col rounded-xl border p-3 sm:col-span-4", chrome)}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-red-500">Strategy</span>
              <p className={cn("mt-2 text-[11px] leading-snug", isDark ? "text-zinc-300" : "text-zinc-700")}>
                North star · priorities · decision rules. One panel. No drift.
              </p>
              <div className="mt-auto space-y-1 pt-2">
                <div className={cn("h-1.5 rounded-full", isDark ? "bg-white/10" : "bg-zinc-200")} />
                <div className={cn("h-1.5 w-4/5 rounded-full", isDark ? "bg-white/10" : "bg-zinc-200")} />
                <div className={cn("h-1.5 w-3/5 rounded-full", isDark ? "bg-white/10" : "bg-zinc-200")} />
              </div>
            </motion.div>

            {/* AI */}
            <motion.div
              className={cn(
                "col-span-2 flex flex-col rounded-xl border border-red-500/35 bg-gradient-to-b p-3 sm:col-span-3",
                isDark ? "from-red-950/40 to-zinc-950/60" : "from-red-50 to-white",
              )}
              animate={{ boxShadow: isDark ? ["0 0 0 0 transparent", "0 0 28px 0 oklch(0.55 0.22 25 / 0.25)", "0 0 0 0 transparent"] : ["0 0 0 0 transparent", "0 0 24px 0 oklch(0.55 0.22 25 / 0.15)", "0 0 0 0 transparent"] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-red-500" />
                <span className="text-xs font-semibold text-red-500">AI</span>
              </div>
              <p className={cn("mt-2 text-[10px] leading-relaxed", isDark ? "text-zinc-300" : "text-zinc-700")}>
                Context from your workspace. Answers tied to objectives—not generic chatter.
              </p>
              <div className="mt-2 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className={cn("size-1.5 rounded-full bg-red-500", isDark && "opacity-90")}
                    animate={{ opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>

            {/* Notes */}
            <motion.div
              className={cn("col-span-2 flex flex-col rounded-xl border p-3 sm:col-span-12 sm:flex-row sm:gap-4", chrome)}
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            >
              <div className="flex-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-500">Notes</span>
                <p className={cn("mt-1 text-[11px]", isDark ? "text-zinc-400" : "text-zinc-600")}>
                  Decisions, briefs, and knowledge—linked to execution.
                </p>
              </div>
              <div className={cn("mt-2 flex flex-1 flex-col gap-1 rounded-lg border p-2 sm:mt-0", isDark ? "border-white/10 bg-black/25" : "border-zinc-200 bg-zinc-50")}>
                <div className={cn("h-2 w-3/4 rounded", isDark ? "bg-white/10" : "bg-zinc-200")} />
                <div className={cn("h-2 w-full rounded", isDark ? "bg-white/10" : "bg-zinc-200")} />
                <div className={cn("h-2 w-5/6 rounded", isDark ? "bg-white/10" : "bg-zinc-200")} />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
