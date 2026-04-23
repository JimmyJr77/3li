import { motion } from "framer-motion";
import { GlassPanel, LandingSection, SectionHeading } from "@/features/landing/LandingPrimitives";
import { useLandingPalette } from "@/features/landing/useLandingPalette";
import { cn } from "@/lib/utils";

const rows = [
  ["Fragmented", "Unified system"],
  ["Reactive", "Structured"],
  ["Generic AI", "Context-aware AI"],
  ["Manual planning", "Assisted planning"],
  ["No methodology", "Built-in consulting frameworks"],
];

export function LandingCompare() {
  const { isDark } = useLandingPalette();

  return (
    <LandingSection className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="This Isn’t Another Tool" />
        <motion.div
          className="mt-14"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <GlassPanel className="overflow-hidden p-0">
            <div
              className={cn(
                "grid grid-cols-2 gap-0 border-b text-center text-xs font-bold uppercase tracking-wider sm:text-sm",
                isDark ? "border-white/10 bg-white/5" : "border-zinc-900/10 bg-zinc-900/[0.03]",
              )}
            >
              <div className={cn("px-3 py-4 sm:px-6", isDark ? "text-zinc-400" : "text-zinc-600")}>Typical Tools</div>
              <div className={cn("border-l px-3 py-4 sm:px-6", isDark ? "border-white/10 text-red-500" : "border-zinc-900/10 text-red-600")}>
                Three Lions Industries
              </div>
            </div>
            {rows.map(([left, right], i) => (
              <div
                key={left}
                className={cn(
                  "grid grid-cols-2 border-b text-sm last:border-b-0 sm:text-base",
                  isDark ? "border-white/10" : "border-zinc-900/10",
                  i % 2 === 0 ? (isDark ? "bg-black/15" : "bg-zinc-50/80") : "",
                )}
              >
                <div className={cn("px-3 py-4 sm:px-6", isDark ? "text-zinc-400" : "text-zinc-600")}>{left}</div>
                <div
                  className={cn(
                    "border-l px-3 py-4 font-semibold sm:px-6",
                    isDark ? "border-white/10 text-white" : "border-zinc-900/10 text-zinc-900",
                  )}
                >
                  {right}
                </div>
              </div>
            ))}
          </GlassPanel>
        </motion.div>
      </div>
    </LandingSection>
  );
}
