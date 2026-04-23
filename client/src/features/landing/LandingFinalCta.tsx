import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GlassPanel, LandingSection } from "@/features/landing/LandingPrimitives";
import { useLandingPalette } from "@/features/landing/useLandingPalette";
import { cn } from "@/lib/utils";

export function LandingFinalCta({ onOpenCommand }: { onOpenCommand?: () => void }) {
  const { isDark } = useLandingPalette();

  return (
    <LandingSection className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <GlassPanel
            className={cn(
              "border-red-500/30 bg-gradient-to-br px-8 py-12 text-center sm:px-12 sm:py-14",
              isDark ? "from-red-950/40 to-zinc-950/90" : "from-red-50 to-white",
            )}
          >
            <h2 className={cn("text-balance text-2xl font-bold tracking-tight sm:text-3xl", isDark ? "text-white" : "text-zinc-900")}>
              If You’re Serious About Running Your Business Properly—Start Here
            </h2>
            <p className={cn("mx-auto mt-4 max-w-xl text-base", isDark ? "text-zinc-400" : "text-zinc-600")}>
              This is how disciplined operators think, plan, and execute.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="bg-red-600 px-8 text-white hover:bg-red-500">
                <Link to="/login">Enter the System</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className={cn(isDark ? "border-white/20 bg-white/5 text-white hover:bg-white/10" : "")}>
                <Link to="/contact">Request Consulting Access</Link>
              </Button>
              {onOpenCommand ? (
                <Button
                  type="button"
                  size="lg"
                  variant="ghost"
                  className={cn(isDark ? "text-zinc-400 hover:text-white" : "text-zinc-600")}
                  onClick={onOpenCommand}
                >
                  Command mode preview
                </Button>
              ) : null}
            </div>
          </GlassPanel>
        </motion.div>
      </div>
    </LandingSection>
  );
}
