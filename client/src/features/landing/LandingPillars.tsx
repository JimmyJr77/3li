import { motion } from "framer-motion";
import { Bot, ClipboardList, Compass, Cpu, ListTodo } from "lucide-react";
import { GlassPanel, LandingSection, SectionHeading } from "@/features/landing/LandingPrimitives";
import { useLandingPalette } from "@/features/landing/useLandingPalette";
import { cn } from "@/lib/utils";

const pillars = [
  {
    icon: Compass,
    title: "Strategy",
    line: "Define direction with clarity and intent",
    detail: "Vision, priorities, decision frameworks",
  },
  {
    icon: Cpu,
    title: "Operations",
    line: "Create rhythm and accountability",
    detail: "Systems, workflows, consistency",
  },
  {
    icon: ClipboardList,
    title: "Planning",
    line: "Turn strategy into structured plans",
    detail: "Roadmaps, sequencing, dependencies",
  },
  {
    icon: ListTodo,
    title: "Execution",
    line: "Actually get work done",
    detail: "Tasks, boards, deliverables",
  },
];

export function LandingPillars() {
  const { isDark } = useLandingPalette();

  return (
    <LandingSection className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="Core Pillars" />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => {
            const Icon = p.icon;
            return (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
            >
              <GlassPanel hoverLift className="group h-full p-6">
                <Icon className="size-8 text-red-500 transition-transform duration-300 group-hover:scale-105" />
                <h3 className={cn("mt-4 text-lg font-bold", isDark ? "text-white" : "text-zinc-900")}>{p.title}</h3>
                <p className={cn("mt-2 text-sm font-medium", isDark ? "text-zinc-300" : "text-zinc-700")}>{p.line}</p>
                <p className={cn("mt-3 text-xs leading-relaxed", isDark ? "text-zinc-500" : "text-zinc-500")}>
                  → {p.detail}
                </p>
              </GlassPanel>
            </motion.div>
            );
          })}
        </div>

        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <GlassPanel
            className={cn(
              "relative overflow-hidden p-8 sm:p-10",
              "border-red-500/40 bg-gradient-to-br",
              isDark ? "from-red-950/50 to-zinc-950/80" : "from-red-50 to-white",
            )}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
              <Bot className="size-10 shrink-0 text-red-500" />
              <div>
                <h3 className={cn("text-xl font-bold tracking-tight", isDark ? "text-white" : "text-zinc-900")}>
                  AI Layer
                </h3>
                <p className={cn("mt-1 text-base font-semibold text-red-500")}>
                  AI That Works Inside Your System—Not Outside It
                </p>
                <p className={cn("mt-3 max-w-2xl text-sm leading-relaxed sm:text-base", isDark ? "text-zinc-300" : "text-zinc-700")}>
                  → Context-aware, secure, embedded in workflow
                </p>
              </div>
            </div>
          </GlassPanel>
        </motion.div>
      </div>
    </LandingSection>
  );
}
