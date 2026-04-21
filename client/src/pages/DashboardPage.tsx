import { Link } from "react-router-dom";
import { WorkspaceDashboardHomeGrid } from "@/components/workspace/WorkspaceDashboardHomeGrid";
import { ComingSoonCard } from "@/components/shared/ComingSoonCard";

export function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Jump into Phase 1 tools. Deeper modules are on the roadmap below.
        </p>
      </div>

      <WorkspaceDashboardHomeGrid className="mt-8" />

      <section className="mt-14">
        <h2 className="text-lg font-semibold">Product roadmap</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Highlights from Phase 2 and Phase 3 — see <Link to="/solutions" className="underline underline-offset-4">Solutions</Link> for the full picture.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <ComingSoonCard
            phase="Phase 2"
            title="Proposal Builder & client workspaces"
            description="Engagement-ready artifacts and dedicated client spaces."
          />
          <ComingSoonCard
            phase="Phase 3"
            title="CRM-lite & automation"
            description="Lightweight pipeline context and repeatable workflows."
          />
        </div>
      </section>
    </div>
  );
}
