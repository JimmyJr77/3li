import { motion } from "framer-motion";
import { LandingBackgroundMesh } from "@/features/landing/LandingBackgroundMesh";
import { LandingCursorGlow } from "@/features/landing/LandingCursorGlow";
import { GlassPanel, LandingSection, SectionHeading } from "@/features/landing/LandingPrimitives";
import { useLandingPalette } from "@/features/landing/useLandingPalette";
import { WorkspaceDashboardHomeGrid } from "@/components/workspace/WorkspaceDashboardHomeGrid";
import { cn } from "@/lib/utils";

const phase2 = [
  { title: "Proposal Builder", description: "Draft and iterate client-ready proposals." },
  { title: "Roadmap Planner", description: "Time-phased plans with dependencies." },
  {
    title: "Dedicated project spaces",
    description: "Per client or engagement—aligned with in-app project spaces under each brand.",
  },
  { title: "Template Library", description: "Reusable assets and playbooks." },
] as const;

const phase3 = [
  { title: "CRM-lite", description: "Lightweight relationship and pipeline context." },
  { title: "Decision Log", description: "Traceable choices and rationale." },
  { title: "Automation workflows", description: "Repeatable flows across tools." },
  { title: "AI-driven task pipelines", description: "From intake to execution with guardrails." },
] as const;

function PhaseCard({
  phase,
  title,
  description,
  isDark,
}: {
  phase: string;
  title: string;
  description: string;
  isDark: boolean;
}) {
  return (
    <GlassPanel hoverLift className="flex h-full flex-col p-5 sm:p-6">
      <p className={cn("text-xs font-bold uppercase tracking-wider text-red-500")}>{phase}</p>
      <h3 className={cn("mt-3 text-base font-bold leading-snug", isDark ? "text-white" : "text-zinc-900")}>{title}</h3>
      <p className={cn("mt-2 flex-1 text-sm leading-relaxed", isDark ? "text-zinc-400" : "text-zinc-600")}>
        {description}
      </p>
    </GlassPanel>
  );
}

export function SolutionsPage() {
  const { isDark } = useLandingPalette();

  return (
    <div className="relative isolate z-[2] overflow-x-hidden">
      <LandingBackgroundMesh />

      <section className="relative px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
        <div className="mx-auto max-w-4xl text-center">
          <motion.p
            className={cn("text-xs font-semibold uppercase tracking-[0.22em]", isDark ? "text-red-500" : "text-red-600")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            Solutions
          </motion.p>
          <motion.h1
            className={cn(
              "mt-4 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl",
              isDark ? "text-white" : "text-zinc-950",
            )}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            One architecture. Clear phases.
          </motion.h1>
          <motion.p
            className={cn(
              "mx-auto mt-6 max-w-3xl text-pretty text-base leading-relaxed sm:text-lg",
              isDark ? "text-zinc-400" : "text-zinc-600",
            )}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            MVP capabilities ship first. Later phases extend the operating system without breaking the core structure.
          </motion.p>
        </div>
      </section>

      <LandingSection className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title="Brands, project spaces, and tools" />
          <motion.div
            className="mt-12"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <GlassPanel className="p-5 sm:p-8">
              <p className={cn("text-sm leading-relaxed sm:text-base", isDark ? "text-zinc-300" : "text-zinc-700")}>
                After you sign in, <span className="font-semibold text-red-500">My brands</span> in the sidebar lists
                each client or company context; the title prefers your Brand Center display name when set. Each row is
                a <span className="font-semibold text-red-500">project space</span> (boards, tasks, and notes scoped
                together). Rapid Router, Notebooks, Brainstorm, boards, tasks, and calendar stay aligned to that
                thread.
              </p>
              <div className={cn("mt-8 border-t pt-8", isDark ? "border-white/10" : "border-zinc-900/10")}>
                <WorkspaceDashboardHomeGrid variant="solutions" />
              </div>
            </GlassPanel>
          </motion.div>
        </div>
      </LandingSection>

      <LandingSection className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title="Phase 2 — Coming soon" description="Planned modules after MVP foundations." />
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {phase2.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
              >
                <PhaseCard phase="Phase 2" title={item.title} description={item.description} isDark={isDark} />
              </motion.div>
            ))}
          </div>
        </div>
      </LandingSection>

      <LandingSection className="px-4 pb-24 pt-4 sm:px-6 sm:pb-32 sm:pt-8">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title="Phase 3 — Coming soon" description="Deeper automation and intelligence." />
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {phase3.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
              >
                <PhaseCard phase="Phase 3" title={item.title} description={item.description} isDark={isDark} />
              </motion.div>
            ))}
          </div>
        </div>
      </LandingSection>

      <LandingCursorGlow />
    </div>
  );
}
