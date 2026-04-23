import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroDashboardMock } from "@/features/landing/HeroDashboardMock";
import { useLandingPalette } from "@/features/landing/useLandingPalette";
import { cn } from "@/lib/utils";

const bullets = [
  "Built for founders, operators, and high-performance teams",
  "Replace scattered tools with one unified command center",
  "Turn ideas into execution—fast",
];

export function LandingHero({ onOpenCommand }: { onOpenCommand: () => void }) {
  const { isDark } = useLandingPalette();

  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-12 sm:px-6 sm:pb-28 sm:pt-16 lg:pt-20">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <motion.p
            className={cn(
              "text-xs font-semibold uppercase tracking-[0.22em]",
              isDark ? "text-red-500" : "text-red-600",
            )}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            Three Lions Industries
          </motion.p>
          <motion.h1
            className={cn(
              "mt-4 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.25rem]",
              isDark ? "text-white" : "text-zinc-950",
            )}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            Run Your Entire Business From One System
          </motion.h1>
          <motion.p
            className={cn(
              "mt-5 max-w-xl text-pretty text-base leading-relaxed sm:text-lg",
              isDark ? "text-zinc-400" : "text-zinc-600",
            )}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Three Lions Industries is a consulting operating system that turns strategy into execution—powered by AI,
            structured thinking, and elite workflows.
          </motion.p>
          <ul className="mt-8 space-y-3">
            {bullets.map((b, i) => (
              <motion.li
                key={b}
                className={cn(
                  "flex gap-3 text-sm font-medium leading-snug sm:text-base",
                  isDark ? "text-zinc-300" : "text-zinc-700",
                )}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.06 }}
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
                {b}
              </motion.li>
            ))}
          </ul>
          <motion.div
            className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.35 }}
          >
            <Button
              asChild
              size="lg"
              className="bg-red-600 px-8 text-white hover:bg-red-500"
            >
              <Link to="/login">Enter the System</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className={cn(isDark ? "border-white/20 bg-white/5 text-white hover:bg-white/10" : "border-zinc-900/15 bg-white/80")}>
              <Link to="/#how-it-works">See How It Works</Link>
            </Button>
            <Button
              type="button"
              size="lg"
              variant="ghost"
              className={cn(
                "gap-2",
                isDark ? "text-zinc-400 hover:bg-white/5 hover:text-white" : "text-zinc-600 hover:bg-zinc-900/5",
              )}
              onClick={onOpenCommand}
            >
              <Terminal className="size-4 text-red-500" />
              Command mode preview
            </Button>
          </motion.div>
        </div>
        <div className="relative lg:pl-4">
          <HeroDashboardMock />
        </div>
      </div>
    </section>
  );
}
