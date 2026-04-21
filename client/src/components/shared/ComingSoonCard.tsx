import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ComingSoonCardProps = {
  title: string;
  description: string;
  phase: "Phase 2" | "Phase 3";
};

export function ComingSoonCard({ title, description, phase }: ComingSoonCardProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{phase}</p>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
