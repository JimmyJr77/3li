import { useState } from "react";
import { LandingAudience } from "@/features/landing/LandingAudience";
import { LandingAuthorityStrip } from "@/features/landing/LandingAuthorityStrip";
import { LandingBackgroundMesh } from "@/features/landing/LandingBackgroundMesh";
import { LandingCompare } from "@/features/landing/LandingCompare";
import { CommandModeOverlay } from "@/features/landing/CommandModeOverlay";
import { LandingCursorGlow } from "@/features/landing/LandingCursorGlow";
import { LandingFinalCta } from "@/features/landing/LandingFinalCta";
import { LandingHero } from "@/features/landing/LandingHero";
import { LandingHowItWorks } from "@/features/landing/LandingHowItWorks";
import { LandingPillars } from "@/features/landing/LandingPillars";
import { LandingProblem } from "@/features/landing/LandingProblem";
import { LandingProductModules } from "@/features/landing/LandingProductModules";
import { LandingSolution } from "@/features/landing/LandingSolution";

export function HomePage() {
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <div className="relative isolate z-[2] overflow-x-hidden">
      <LandingBackgroundMesh />
      <LandingHero onOpenCommand={() => setCommandOpen(true)} />
      <LandingAuthorityStrip />
      <LandingProblem />
      <LandingSolution />
      <LandingPillars />
      <LandingHowItWorks />
      <LandingProductModules />
      <LandingCompare />
      <LandingAudience />
      <LandingFinalCta onOpenCommand={() => setCommandOpen(true)} />
      <LandingCursorGlow />
      <CommandModeOverlay open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
