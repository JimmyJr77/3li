import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LandingBackgroundMesh } from "@/features/landing/LandingBackgroundMesh";
import { LandingCursorGlow } from "@/features/landing/LandingCursorGlow";
import { GlassPanel, LandingSection } from "@/features/landing/LandingPrimitives";
import { useLandingPalette } from "@/features/landing/useLandingPalette";
import { cn } from "@/lib/utils";

export function ContactPage() {
  const { isDark } = useLandingPalette();

  const fieldClass =
    "min-h-[44px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

  return (
    <div className="relative isolate z-[2] overflow-x-hidden">
      <LandingBackgroundMesh />

      <section className="relative px-4 pb-8 pt-12 sm:px-6 sm:pb-12 sm:pt-16">
        <div className="mx-auto max-w-4xl text-center">
          <motion.p
            className={cn("text-xs font-semibold uppercase tracking-[0.22em]", isDark ? "text-red-500" : "text-red-600")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            Contact
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
            Start the conversation.
          </motion.h1>
          <motion.p
            className={cn(
              "mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed sm:text-lg",
              isDark ? "text-zinc-400" : "text-zinc-600",
            )}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Tell us what you’re running, where it breaks, and what “under control” looks like. We read every message.
            Wire this form to your CRM or inbox when you’re ready.
          </motion.p>
        </div>
      </section>

      <LandingSection className="px-4 pb-24 sm:px-6 sm:pb-32">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-14">
          <motion.div
            className="hidden lg:block"
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <GlassPanel className="p-8">
              <p className={cn("text-sm font-bold uppercase tracking-wider text-red-500")}>Direct line</p>
              <p className={cn("mt-4 text-base font-semibold leading-snug", isDark ? "text-white" : "text-zinc-900")}>
                No intake theater. No generic “tell us about your business” essay.
              </p>
              <ul className={cn("mt-6 space-y-3 text-sm leading-relaxed", isDark ? "text-zinc-400" : "text-zinc-600")}>
                <li className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
                  Name, email, and a tight note are enough to route you.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
                  Prefer to explore first? Use the product, then come back.
                </li>
              </ul>
              <Button
                asChild
                variant="outline"
                className={cn("mt-8", isDark ? "border-white/20 bg-white/5 text-white hover:bg-white/10" : "")}
              >
                <Link to="/login">Enter the System</Link>
              </Button>
            </GlassPanel>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
            <GlassPanel className="p-6 sm:p-8">
              <form
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="name" className={cn(isDark ? "text-zinc-200" : "")}>
                    Name
                  </Label>
                  <Input id="name" name="name" autoComplete="name" placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className={cn(isDark ? "text-zinc-200" : "")}>
                    Email
                  </Label>
                  <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message" className={cn(isDark ? "text-zinc-200" : "")}>
                    Message
                  </Label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    placeholder="Context, constraints, what you need from us."
                    className={fieldClass}
                  />
                </div>
                <Button type="submit" className="bg-red-600 text-white hover:bg-red-500">
                  Send (stub)
                </Button>
              </form>
            </GlassPanel>
          </motion.div>
        </div>
      </LandingSection>

      <LandingCursorGlow />
    </div>
  );
}
