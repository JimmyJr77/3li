import { motion } from "framer-motion";
import { GlassPanel, LandingSection, SectionHeading } from "@/features/landing/LandingPrimitives";
import { useLandingPalette } from "@/features/landing/useLandingPalette";
import { cn } from "@/lib/utils";

export function LandingSolution() {
  const { isDark } = useLandingPalette();

  return (
    <LandingSection className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="This Is Your Operating System for Growth" />
        <motion.div
          className="mx-auto mt-12 max-w-3xl"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <GlassPanel className="p-8 sm:p-10">
            <p
              className={cn(
                "text-center text-base font-medium leading-relaxed sm:text-lg",
                isDark ? "text-zinc-300" : "text-zinc-700",
              )}
            >
              3LI combines consulting frameworks, execution tools, and AI into one structured environment where your
              business actually runs.
            </p>
          </GlassPanel>
        </motion.div>
      </div>
    </LandingSection>
  );
}
