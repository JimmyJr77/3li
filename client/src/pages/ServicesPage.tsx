import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Bot, ClipboardList, Compass, Cpu, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingBackgroundMesh } from "@/features/landing/LandingBackgroundMesh";
import { LandingCursorGlow } from "@/features/landing/LandingCursorGlow";
import { GlassPanel, LandingSection, SectionHeading } from "@/features/landing/LandingPrimitives";
import { useLandingPalette } from "@/features/landing/useLandingPalette";
import { cn } from "@/lib/utils";

const beforeAfter = {
  before: [
    "Strategy lives in documents",
    "Teams operate independently",
    "Execution is inconsistent",
    "Decisions are reactive",
    "Tools are fragmented",
  ],
  after: [
    "Strategy drives daily execution",
    "Teams operate in sync",
    "Work flows through structured systems",
    "Decisions follow defined frameworks",
    "Everything runs in one environment",
  ],
};

const coreOfferings = [
  {
    icon: Compass,
    headline: "Clarity of Direction. Confidence in Decisions.",
    title: "Strategy",
    do: ["Define positioning and competitive advantage", "Frame opportunities and risks", "Build decision-making frameworks"],
    get: ["Clear strategic direction", "Prioritized initiatives", "Leadership alignment"],
  },
  {
    icon: Cpu,
    headline: "Structure That Holds Teams Accountable",
    title: "Operations",
    do: ["Design operating rhythms (weekly/monthly cadence)", "Establish accountability systems", "Align teams to execution flow"],
    get: ["Predictable execution cycles", "Clear ownership across teams", "Reduced friction in delivery"],
  },
  {
    icon: ClipboardList,
    headline: "From Ideas to Executable Plans",
    title: "Planning",
    do: ["Translate strategy into phased roadmaps", "Define dependencies and sequencing", "Structure initiatives into actionable units"],
    get: ["Roadmaps that actually get followed", "Visibility into what happens next", "Reduced planning ambiguity"],
  },
  {
    icon: ListTodo,
    headline: "Relentless Progress, Tracked and Visible",
    title: "Execution",
    do: ["Implement task systems and workflow boards", "Build execution tracking and visibility", "Capture knowledge and decisions in real time"],
    get: ["Work that moves forward consistently", "Full visibility into progress", "Institutional knowledge retained"],
  },
] as const;

const engageSteps = [
  { title: "Assess & Structure", body: "Understand your business, constraints, and goals" },
  { title: "Design the System", body: "Build your strategy, workflows, and planning structure" },
  { title: "Implement & Integrate", body: "Deploy tools, boards, and execution systems" },
  { title: "Operate & Refine", body: "Continuously optimize based on performance" },
] as const;

const tiers = [
  {
    name: "Advisory",
    lines: ["Strategic guidance", "Light system design", "Periodic engagement"],
  },
  {
    name: "Embedded Consulting",
    lines: ["Hands-on system implementation", "Workflow design and rollout", "Direct involvement in execution"],
  },
  {
    name: "Full Operating System Deployment",
    lines: ["End-to-end build of your business system", "AI integration", "Ongoing optimization"],
  },
] as const;

const audience = [
  "Founders scaling beyond chaos",
  "Operators managing complex teams",
  "Businesses outgrowing their current systems",
  "Consultants managing multiple clients",
];

function ListBlock({
  label,
  items,
  isDark,
}: {
  label: string;
  items: readonly string[];
  isDark: boolean;
}) {
  return (
    <div>
      <p className={cn("text-xs font-bold uppercase tracking-wider text-red-500")}>{label}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className={cn(
              "flex gap-2 text-sm leading-snug",
              isDark ? "text-zinc-300" : "text-zinc-700",
            )}
          >
            <span className="mt-2 size-1 shrink-0 rounded-full bg-red-500" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ServicesPage() {
  const { isDark } = useLandingPalette();

  return (
    <div className="relative isolate z-[2] overflow-x-hidden">
      <LandingBackgroundMesh />
      {/* Page hero */}
      <section className="relative px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
        <div className="mx-auto max-w-4xl text-center">
          <motion.p
            className={cn("text-xs font-semibold uppercase tracking-[0.22em]", isDark ? "text-red-500" : "text-red-600")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            Services
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
            How We Take You From Chaos to Control
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
            Three Lions Industries doesn’t just advise—we install a system that runs your business with clarity,
            structure, and execution discipline.
          </motion.p>
          <motion.p
            className={cn("mt-4 text-sm font-medium tracking-wide", isDark ? "text-zinc-500" : "text-zinc-500")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.2 }}
          >
            This is consulting, engineered.
          </motion.p>
        </div>
      </section>

      {/* Philosophy */}
      <LandingSection className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title="We Don’t Give Advice. We Build Operating Systems." />
          <motion.div
            className="mx-auto mt-12 max-w-3xl"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <GlassPanel className="p-8 sm:p-10">
              <p className={cn("text-center text-base font-medium leading-relaxed sm:text-lg", isDark ? "text-zinc-300" : "text-zinc-700")}>
                Most consulting firms deliver slides.
                <br />
                We deliver structure.
              </p>
              <p className={cn("mt-6 text-center text-sm leading-relaxed sm:text-base", isDark ? "text-zinc-400" : "text-zinc-600")}>
                3LI embeds directly into how your business thinks, plans, and executes—so outcomes aren’t dependent on
                meetings, but on systems that persist.
              </p>
            </GlassPanel>
          </motion.div>
        </div>
      </LandingSection>

      {/* Before / After */}
      <LandingSection className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title="What Changes When You Work With Us" />
          <motion.div
            className="mt-14 grid gap-4 lg:grid-cols-2"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <GlassPanel className="p-6 sm:p-8">
              <p className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-zinc-500" : "text-zinc-500")}>
                Before 3LI
              </p>
              <ul className="mt-6 space-y-3">
                {beforeAfter.before.map((line) => (
                  <li key={line} className={cn("flex gap-3 text-sm font-medium", isDark ? "text-zinc-300" : "text-zinc-700")}>
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-zinc-500" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </GlassPanel>
            <GlassPanel
              className={cn(
                "border-red-500/35 p-6 sm:p-8",
                "bg-gradient-to-br",
                isDark ? "from-red-950/35 to-white/[0.04]" : "from-red-50 to-white/90",
              )}
            >
              <p className="text-sm font-bold uppercase tracking-wider text-red-500">After 3LI</p>
              <ul className="mt-6 space-y-3">
                {beforeAfter.after.map((line) => (
                  <li key={line} className={cn("flex gap-3 text-sm font-medium", isDark ? "text-zinc-200" : "text-zinc-800")}>
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </GlassPanel>
          </motion.div>
        </div>
      </LandingSection>

      {/* Core service model */}
      <LandingSection className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title="Core Service Model" />
          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            {coreOfferings.map((offering, i) => {
              const Icon = offering.icon;
              return (
                <motion.div
                  key={offering.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                >
                  <GlassPanel hoverLift className="h-full p-6 sm:p-8">
                    <Icon className="size-8 text-red-500" />
                    <p className={cn("mt-2 text-xs font-bold uppercase tracking-wider text-red-500/90")}>{offering.title}</p>
                    <h3 className={cn("mt-3 text-xl font-bold leading-snug tracking-tight", isDark ? "text-white" : "text-zinc-900")}>
                      {offering.headline}
                    </h3>
                    <div className="mt-6 grid gap-8 sm:grid-cols-2">
                      <ListBlock label="What we do" items={offering.do} isDark={isDark} />
                      <ListBlock label="What you get" items={offering.get} isDark={isDark} />
                    </div>
                  </GlassPanel>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <GlassPanel
              className={cn(
                "border-red-500/40 p-8 sm:p-10",
                "bg-gradient-to-br",
                isDark ? "from-red-950/50 to-zinc-950/80" : "from-red-50 to-white",
              )}
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
                <Bot className="size-10 shrink-0 text-red-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-red-500">AI-Powered Solutioning</p>
                  <h3 className={cn("mt-2 text-2xl font-bold tracking-tight", isDark ? "text-white" : "text-zinc-900")}>
                    AI That Works Inside Your System—Not Outside It
                  </h3>
                  <p className={cn("mt-4 max-w-2xl text-sm leading-relaxed sm:text-base", isDark ? "text-zinc-300" : "text-zinc-700")}>
                    Most AI tools operate in isolation.
                    <br />
                    Ours operates inside your business context.
                  </p>
                  <div className="mt-8 grid gap-8 border-t border-red-500/20 pt-8 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-red-500">What we do</p>
                      <ul className="mt-3 space-y-2">
                        {[
                          "Embed AI into your workflows",
                          "Use structured context for decision support",
                          "Generate plans, insights, and outputs tied to your system",
                        ].map((item) => (
                          <li key={item} className={cn("flex gap-2 text-sm", isDark ? "text-zinc-300" : "text-zinc-700")}>
                            <span className="mt-2 size-1 shrink-0 rounded-full bg-red-500" aria-hidden />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <p className={cn("mt-6 text-xs font-semibold leading-relaxed", isDark ? "text-zinc-400" : "text-zinc-600")}>
                        Critical differentiator: All AI interactions are server-side and secure—never exposed to the
                        browser.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-red-500">What you get</p>
                      <ul className="mt-3 space-y-2">
                        {["Smarter decisions", "Faster planning cycles", "AI that actually understands your business"].map((item) => (
                          <li key={item} className={cn("flex gap-2 text-sm", isDark ? "text-zinc-300" : "text-zinc-700")}>
                            <span className="mt-2 size-1 shrink-0 rounded-full bg-red-500" aria-hidden />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </GlassPanel>
          </motion.div>
        </div>
      </LandingSection>

      {/* How we engage */}
      <LandingSection className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title="How We Work With You" />
          <div className="mt-14 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
            {engageSteps.map((step, i) => (
              <motion.div
                key={step.title}
                className="min-w-[240px] snap-center md:min-w-0"
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
              >
                <GlassPanel hoverLift className="h-full p-5 sm:p-6">
                  <span className={cn("font-mono text-xs font-bold tabular-nums text-red-500")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className={cn("mt-3 text-base font-bold", isDark ? "text-white" : "text-zinc-900")}>{step.title}</h3>
                  <p className={cn("mt-2 text-sm leading-relaxed", isDark ? "text-zinc-400" : "text-zinc-600")}>{step.body}</p>
                </GlassPanel>
              </motion.div>
            ))}
          </div>
        </div>
      </LandingSection>

      {/* Tiers */}
      <LandingSection className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title="Flexible Engagement Models" />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {tiers.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
              >
                <GlassPanel hoverLift className="flex h-full flex-col p-6 sm:p-8">
                  <h3 className={cn("text-lg font-bold", isDark ? "text-white" : "text-zinc-900")}>{tier.name}</h3>
                  <ul className="mt-6 flex flex-1 flex-col gap-3">
                    {tier.lines.map((line) => (
                      <li key={line} className={cn("flex gap-2 text-sm leading-snug", isDark ? "text-zinc-300" : "text-zinc-700")}>
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-red-500" aria-hidden />
                        {line}
                      </li>
                    ))}
                  </ul>
                </GlassPanel>
              </motion.div>
            ))}
          </div>
        </div>
      </LandingSection>

      {/* Who */}
      <LandingSection className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title="This Works Best For" />
          <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2">
            {audience.map((line, i) => (
              <motion.div
                key={line}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
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

      {/* Close */}
      <LandingSection className="px-4 pb-24 pt-8 sm:px-6 sm:pb-32">
        <div className="mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <GlassPanel
              className={cn(
                "border-red-500/30 bg-gradient-to-br px-8 py-12 text-center sm:px-12 sm:py-14",
                isDark ? "from-red-950/40 to-zinc-950/90" : "from-red-50 to-white",
              )}
            >
              <h2 className={cn("text-balance text-2xl font-bold tracking-tight sm:text-3xl", isDark ? "text-white" : "text-zinc-900")}>
                You Don’t Need More Advice. You Need a System.
              </h2>
              <p className={cn("mx-auto mt-4 max-w-xl text-base", isDark ? "text-zinc-400" : "text-zinc-600")}>
                3LI installs the structure that turns intent into outcome—consistently.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="bg-red-600 px-8 text-white hover:bg-red-500">
                  <Link to="/contact">Start Working With 3LI</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className={cn(isDark ? "border-white/20 bg-white/5 text-white hover:bg-white/10" : "")}>
                  <Link to="/login">Enter the System</Link>
                </Button>
              </div>
            </GlassPanel>
          </motion.div>
        </div>
      </LandingSection>

      <LandingCursorGlow />
    </div>
  );
}
