import { Link } from "react-router-dom";
import { ComingSoonCard } from "@/components/shared/ComingSoonCard";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const mvpTools = [
  { title: "Brainstorming Studio", body: "Expand ideas into structured concepts.", to: "/app/brainstorm" },
  { title: "Task Manager", body: "Prioritized lists tied to delivery.", to: "/app/tasks" },
  { title: "Kanban Board", body: "Visual flow for initiatives and workstreams.", to: "/app/boards" },
  { title: "Notes / Knowledge Base", body: "Durable context and references.", to: "/app/notes" },
  { title: "AI Chat Assistant", body: "Consulting assistant over secure APIs.", to: "/app/chat" },
] as const;

const phase2 = [
  { title: "Proposal Builder", description: "Draft and iterate client-ready proposals." },
  { title: "Roadmap Planner", description: "Time-phased plans with dependencies." },
  { title: "Client Workspaces", description: "Dedicated spaces per engagement." },
  { title: "Template Library", description: "Reusable assets and playbooks." },
] as const;

const phase3 = [
  { title: "CRM-lite", description: "Lightweight relationship and pipeline context." },
  { title: "Decision Log", description: "Traceable choices and rationale." },
  { title: "Automation workflows", description: "Repeatable flows across tools." },
  { title: "AI-driven task pipelines", description: "From intake to execution with guardrails." },
] as const;

export function SolutionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Solutions</h1>
        <p className="mt-3 text-muted-foreground">
          MVP capabilities ship first; later phases extend the operating system without changing the
          core architecture.
        </p>
      </div>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Phase 1 — MVP</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Available in the workspace as we build each module out.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mvpTools.map((t) => (
            <Card key={t.title} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">{t.title}</CardTitle>
                <CardDescription>{t.body}</CardDescription>
                <Button asChild variant="outline" size="sm" className="mt-4 w-fit">
                  <Link to={t.to}>Open in workspace</Link>
                </Button>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold">Phase 2 — Coming soon</h2>
        <p className="mt-1 text-sm text-muted-foreground">Planned modules after MVP foundations.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {phase2.map((item) => (
            <ComingSoonCard key={item.title} phase="Phase 2" title={item.title} description={item.description} />
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold">Phase 3 — Coming soon</h2>
        <p className="mt-1 text-sm text-muted-foreground">Deeper automation and intelligence.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {phase3.map((item) => (
            <ComingSoonCard key={item.title} phase="Phase 3" title={item.title} description={item.description} />
          ))}
        </div>
      </section>
    </div>
  );
}
