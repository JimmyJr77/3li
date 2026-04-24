import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Inbox } from "lucide-react";
import { WorkspaceDashboardHomeGrid } from "@/components/workspace/WorkspaceDashboardHomeGrid";
import { ComingSoonCard } from "@/components/shared/ComingSoonCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { useMailroomRouting } from "@/context/MailroomRoutingContext";
import { DashboardAgentHubShell } from "@/features/agents/DashboardAgentHubShell";
import { fetchRoutingHolds } from "@/features/taskflow/api";

export function DashboardPage() {
  const { openMailroom } = useMailroomRouting();
  const { activeWorkspaceId } = useActiveWorkspace();
  const holdsQuery = useQuery({
    queryKey: ["routing-holds", activeWorkspaceId],
    queryFn: () => fetchRoutingHolds(activeWorkspaceId!),
    enabled: Boolean(activeWorkspaceId),
  });
  const pendingCount = holdsQuery.data?.length ?? 0;

  return (
    <div className="w-full min-w-0">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>

      <Card className="mt-6 border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Agents</CardTitle>
          <CardDescription>
            Open an agent to review saved sessions on the left and history on the right. Use{" "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-4"
              onClick={() => openMailroom()}
            >
              Mailroom
            </button>{" "}
            for the guided routing checklist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DashboardAgentHubShell workspaceId={activeWorkspaceId} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="size-4 text-muted-foreground" aria-hidden />
            Holding pen
          </CardTitle>
          <CardDescription>
            {holdsQuery.isLoading
              ? "Loading queue…"
              : pendingCount === 0
                ? "No queued captures. Add text on Rapid Router or queue Mail Clerk chunks."
                : `${pendingCount} item${pendingCount === 1 ? "" : "s"} waiting to be routed.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" size="sm" variant={pendingCount ? "default" : "outline"} asChild>
            <Link to="/app/rapid-router">Open Rapid Router</Link>
          </Button>
        </CardContent>
      </Card>

      <WorkspaceDashboardHomeGrid className="mt-8" />

      <section className="mt-14">
        <h2 className="text-lg font-semibold">Product roadmap</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Highlights from Phase 2 and Phase 3 — see{" "}
          <Link to="/solutions" className="underline underline-offset-4">
            Solutions
          </Link>{" "}
          for the full picture.
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
