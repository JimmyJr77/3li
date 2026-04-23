import { motion } from "framer-motion";
import { GlassPanel } from "@/features/landing/LandingPrimitives";
import { useLandingPalette } from "@/features/landing/useLandingPalette";
import { cn } from "@/lib/utils";

const lines = [
  "Built for operators, not observers",
  "Designed from real-world consulting workflows",
  "Used to structure multi-entity operations",
];

export function LandingAuthorityStrip() {
  const { isDark } = useLandingPalette();

  return (
    <section className="border-y px-4 py-10 sm:px-6" aria-label="Authority">
      <div className="mx-auto max-w-6xl">
        <GlassPanel className="px-4 py-8 sm:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {lines.map((text, i) => (
              <motion.p
                key={text}
                className={cn(
                  "text-center text-sm font-semibold leading-snug sm:text-base",
                  isDark ? "text-zinc-200" : "text-zinc-800",
                )}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
              >
                {text}
              </motion.p>
            ))}
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}
