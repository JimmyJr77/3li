import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Three Lions Industries
        </p>
        <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Your consulting operating system
        </h1>
        <p className="mt-6 text-pretty text-lg text-muted-foreground">
          Centralize strategy, operations, planning, and execution—with AI-powered solutioning in one
          modern workspace.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link to="/register">Create account</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/services">Explore services</Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-20 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Strategy", body: "Align direction and priorities with clarity." },
          { title: "Operations", body: "Run delivery with consistent rhythm." },
          { title: "Planning", body: "Turn ideas into sequenced, actionable plans." },
          { title: "Execution", body: "Ship work with tasks, boards, and notes." },
          { title: "AI layer", body: "Assist decisions—always through secure server APIs." },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border bg-card p-6 text-left shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
