import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const services = [
  {
    title: "Strategy",
    description: "Positioning, opportunity framing, and decision-ready narratives.",
  },
  {
    title: "Operations",
    description: "Operating cadence, accountability, and delivery mechanics.",
  },
  {
    title: "Planning",
    description: "Structured roadmaps and phased execution plans.",
  },
  {
    title: "Execution",
    description: "Task systems, visual workflow, and knowledge capture.",
  },
  {
    title: "AI-powered solutioning",
    description: "Consulting-grade assistance—invoked only from the server, never from the browser.",
  },
] as const;

export function ServicesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Services</h1>
        <p className="mt-3 text-muted-foreground">
          How Three Lions Industries supports teams from intent to outcome.
        </p>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {services.map((s) => (
          <Card key={s.title}>
            <CardHeader>
              <CardTitle>{s.title}</CardTitle>
              <CardDescription>{s.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
