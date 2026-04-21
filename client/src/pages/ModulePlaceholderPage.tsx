import type { LucideIcon } from "lucide-react";

export function ModulePlaceholderPage({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <p className="text-sm text-muted-foreground">
        Service boundaries and data shapes are ready in the task manager foundation; full modules ship in a later
        iteration.
      </p>
    </div>
  );
}
