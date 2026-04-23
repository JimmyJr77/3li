import { motion } from "framer-motion";
import { GlassPanel, LandingSection, SectionHeading } from "@/features/landing/LandingPrimitives";
import { useLandingPalette } from "@/features/landing/useLandingPalette";
import { cn } from "@/lib/utils";

const audience = [
  "Founders scaling companies",
  "Operators running complex teams",
  "Consultants managing multiple clients",
  "High-performers who want control",
];

export function LandingAudience() {
  const { isDark } = useLandingPalette();

  return (
    <LandingSection className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="Built For" />
        <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2">
          {audience.map((line, i) => (
            <motion.div
              key={line}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            >
              <GlassPanel hoverLift className="flex items-center gap-3 p-5">
                <span className="size-2 shrink-0 rounded-full bg-red-500" aria-hidden />
                <p className={cn("text-base font-semibold", isDark ? "text-white" : "text-zinc-900")}>{line}</p>
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
