import { motion } from "framer-motion";
import { GlassPanel, LandingSection, SectionHeading } from "@/features/landing/LandingPrimitives";
import { useLandingPalette } from "@/features/landing/useLandingPalette";
import { cn } from "@/lib/utils";

const problems = [
  { title: "Tools don’t connect", body: "Data and work live in silos. Context dies in handoffs." },
  { title: "Strategy doesn’t translate into execution", body: "Plans look sharp on a slide. Monday looks different." },
  { title: "Teams operate without alignment", body: "Everyone is busy. Few moves compound." },
  { title: "Decisions are reactive instead of structured", body: "Fire drills replace judgment. Momentum stalls." },
];

export function LandingProblem() {
  const { isDark } = useLandingPalette();

  return (
    <LandingSection className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="Most Businesses Don’t Have a System. They Have Chaos." />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            >
              <GlassPanel hoverLift className="h-full p-5">
                <h3 className={cn("text-base font-bold leading-snug", isDark ? "text-white" : "text-zinc-900")}>
                  {p.title}
                </h3>
                <p className={cn("mt-3 text-sm leading-relaxed", isDark ? "text-zinc-400" : "text-zinc-600")}>
                  {p.body}
                </p>
              </GlassPanel>
            </motion.div>
          ))}
        </div>
        <motion.p
          className={cn(
            "mt-12 text-center text-lg font-semibold tracking-tight sm:text-xl",
            isDark ? "text-white" : "text-zinc-900",
          )}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          3LI fixes this.
        </motion.p>
      </div>
    </LandingSection>
  );
}
