import { motion } from "framer-motion";
import { GlassPanel, LandingSection, SectionHeading } from "@/features/landing/LandingPrimitives";
import { useLandingPalette } from "@/features/landing/useLandingPalette";
import { cn } from "@/lib/utils";

const steps = [
  "Define Your Business Context",
  "Structure Strategy & Objectives",
  "Generate Plans Automatically",
  "Execute Through Integrated Tools",
  "Continuously Optimize with AI",
];

export function LandingHowItWorks() {
  const { isDark } = useLandingPalette();

  return (
    <LandingSection id="how-it-works" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="How it works" title="Simple. Sequenced. Repeatable." />
        <div className="mt-14 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-5 md:overflow-visible md:pb-0">
          {steps.map((label, i) => (
            <motion.div
              key={label}
              className="min-w-[220px] snap-center md:min-w-0"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            >
              <GlassPanel className="relative h-full p-5">
                <span
                  className={cn(
                    "font-mono text-xs font-bold tabular-nums",
                    isDark ? "text-red-500" : "text-red-600",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className={cn("mt-3 text-sm font-semibold leading-snug", isDark ? "text-white" : "text-zinc-900")}>
                  {label}
                </p>
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
