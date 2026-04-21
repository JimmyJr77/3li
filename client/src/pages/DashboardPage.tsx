import { Link } from "react-router-dom";
import { ComingSoonCard } from "@/components/shared/ComingSoonCard";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const tools = [
  { title: "Rapid Router", to: "/app/rapid-router", body: "Capture text and route it to backlog, notes, or brainstorm." },
  { title: "Activity", to: "/app/notifications", body: "Workspace task activity feed." },
  { title: "Task Lists", to: "/app/my-tasks", body: "All tasks across boards." },
  { title: "Boards", to: "/app/boards", body: "Workspaces, templates, and Trello-style boards." },
  { title: "Calendar", to: "/app/calendar", body: "Due dates on a month grid." },
  { title: "Brainstorm", to: "/app/brainstorm", body: "Structured ideation." },
  { title: "Notes", to: "/app/notes", body: "Knowledge base." },
  { title: "Chat", to: "/app/chat", body: "AI assistant (server-side)." },
  { title: "Settings", to: "/app/settings", body: "Workspace preferences." },
] as const;

export function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Jump into Phase 1 tools. Deeper modules are on the roadmap below.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        {tools.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group relative aspect-square w-full min-w-0 cursor-pointer rounded-xl text-inherit no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Card
              size="sm"
              className="absolute inset-0 h-full min-h-0 flex-col shadow-sm transition-shadow duration-300 ease-out group-hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.22),0_8px_20px_-8px_rgba(0,0,0,0.1)] dark:group-hover:shadow-[0_22px_56px_-12px_rgba(0,0,0,0.65),0_10px_24px_-10px_rgba(0,0,0,0.45)]"
            >
              <CardHeader className="h-full min-h-0 flex-1 flex-col justify-start gap-2 px-3 py-0 pt-3 pb-3">
                <CardTitle className="line-clamp-2 text-base leading-snug">{t.title}</CardTitle>
                <CardDescription className="line-clamp-[6] min-h-0 text-xs leading-snug">
                  {t.body}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

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
