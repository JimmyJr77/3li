import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const defaultPendingLabel = "Creating…";

/** Shared “create label” block: ticket sheet, project board settings, and brand ticket labels panel. */
export function NewTicketLabelForm({
  title,
  hint,
  name,
  onNameChange,
  color,
  onColorChange,
  disabled,
  pending,
  onSubmit,
  submitLabel,
  pendingLabel = defaultPendingLabel,
  errorMessage,
}: {
  title: string;
  hint?: string;
  name: string;
  onNameChange: (value: string) => void;
  color: string;
  onColorChange: (value: string) => void;
  disabled: boolean;
  pending: boolean;
  onSubmit: () => void;
  submitLabel: string;
  /** Shown while `pending` (e.g. “Adding…” vs “Creating…”). */
  pendingLabel?: string;
  errorMessage?: string | null;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/15 p-3">
      <Label className="text-xs font-medium text-muted-foreground">{title}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Name"
          value={name}
          disabled={disabled}
          onChange={(e) => onNameChange(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Label color"
            value={color}
            disabled={disabled}
            onChange={(e) => onColorChange(e.target.value)}
            className="size-9 cursor-pointer rounded border border-input bg-background p-0.5"
          />
          <Button
            type="button"
            size="sm"
            disabled={disabled || pending || !name.trim()}
            onClick={onSubmit}
          >
            {pending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </div>
      {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
    </div>
  );
}
