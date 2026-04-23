import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLandingPalette } from "@/features/landing/useLandingPalette";

const sectionMotion = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-72px" },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
};

export function LandingSection({
  className,
  children,
  ...props
}: HTMLMotionProps<"section"> & { className?: string }) {
  return (
    <motion.section className={cn("relative", className)} {...sectionMotion} {...props}>
      {children}
    </motion.section>
  );
}

export function GlassPanel({
  className,
  children,
  hoverLift,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hoverLift?: boolean }) {
  const { isDark } = useLandingPalette();
  return (
    <div
      className={cn(
        "rounded-2xl border shadow-xl backdrop-blur-xl transition-shadow duration-300",
        isDark
          ? "border-white/10 bg-white/[0.05] shadow-black/40"
          : "border-zinc-900/10 bg-white/70 shadow-zinc-900/10",
        hoverLift && "transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  const { isDark } = useLandingPalette();
  return (
    <div className={cn("mx-auto max-w-3xl text-center", className)}>
      {eyebrow ? (
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.2em]",
            isDark ? "text-red-500" : "text-red-600",
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          "mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl",
          isDark ? "text-white" : "text-zinc-900",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-4 text-pretty text-base sm:text-lg",
            isDark ? "text-zinc-400" : "text-zinc-600",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
