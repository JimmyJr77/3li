import { motion } from "framer-motion";
import { BookOpen, Bot, Kanban, Lightbulb, Map } from "lucide-react";
import { GlassPanel, LandingSection, SectionHeading } from "@/features/landing/LandingPrimitives";
import { useLandingPalette } from "@/features/landing/useLandingPalette";
import { cn } from "@/lib/utils";

const modules = [
  {
    icon: Lightbulb,
    title: "Brainstorming Studio",
    body: "Shape problems fast. Capture options. Commit what matters.",
  },
  {
    icon: Kanban,
    title: "Task Manager",
    body: "Boards and lists that stay tied to priorities—not busywork.",
  },
  {
    icon: Map,
    title: "Strategic Planning Engine",
    body: "Sequence work. Surface dependencies. Keep the thread tight.",
  },
  {
    icon: BookOpen,
    title: "Document + Knowledge System",
    body: "Notes and references where operators actually work.",
  },
  {
    icon: Bot,
    title: "AI Consulting Assistant",
    body: "Answers grounded in your context. No toy prompts.",
  },
];

export function LandingProductModules() {
  const { isDark } = useLandingPalette();

  return (
    <LandingSection className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="Everything You Need. Nothing You Don’t." />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                whileHover={{ y: -4 }}
              >
                <GlassPanel className="group h-full p-6 transition-shadow duration-300 hover:shadow-2xl">
                  <Icon className="size-8 text-red-500 transition-transform duration-300 group-hover:scale-105" />
                  <h3 className={cn("mt-4 text-lg font-bold", isDark ? "text-white" : "text-zinc-900")}>{m.title}</h3>
                  <p className={cn("mt-2 text-sm leading-relaxed", isDark ? "text-zinc-400" : "text-zinc-600")}>
                    {m.body}
                  </p>
                </GlassPanel>
              </motion.div>
            );
          })}
        </div>
      </div>
    </LandingSection>
  );
}
