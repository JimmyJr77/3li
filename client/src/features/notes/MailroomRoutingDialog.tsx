import { ChevronLeft, ChevronRight, Mail } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type MailroomRoutingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const STEPS = [
  {
    title: "Intake",
    body: "Summarize this capture in one line. If there are multiple topics, split them into separate ideas before routing.",
    prompt: "What is the single outcome you want from this capture?",
  },
  {
    title: "Destinations",
    body: "Match each segment to notebooks, a Brainstorm studio board, a project board, tasks, or a holding pen. When unsure, use the holding pen and note what clarification you need.",
    prompt: "List destinations with one sentence why each fits.",
  },
  {
    title: "Tasks & handoff",
    body: "Turn actionable parts into a small number of tasks with titles. Optional: add acceptance-criteria hints for the PM Agent later.",
    prompt: "Draft 1–3 tasks from the actionable part of this capture.",
  },
] as const;

/**
 * Guided Mail Clerk / Mailroom flow. Full AI routing runs on Rapid Router; this wizard uses standardized prompts from docs/agents.
 */
export function MailroomRoutingDialog({ open, onOpenChange }: MailroomRoutingDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const reset = (nextOpen: boolean) => {
    if (!nextOpen) setStep(0);
    onOpenChange(nextOpen);
  };

  const at = STEPS[step]!;

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="flex items-center gap-2">
          <Mail className="size-5 text-muted-foreground" aria-hidden />
          Mailroom routing
        </DialogTitle>
        <DialogDescription>
          Step {step + 1} of {STEPS.length}: {at.title}. Work through each step, then open Rapid Router to apply routes,
          queue items in the holding pen, or run Mail Clerk / Red Team prompts there.
        </DialogDescription>

        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm text-foreground">
          <p className="text-muted-foreground">{at.body}</p>
          <p className="font-medium text-foreground">Prompt to use</p>
          <p className="rounded-md bg-background/80 px-3 py-2 text-muted-foreground">{at.prompt}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:gap-2">
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ChevronLeft className="mr-1 size-4" aria-hidden />
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" size="sm" className="flex-1 sm:flex-initial" onClick={() => setStep((s) => s + 1)}>
                Next
                <ChevronRight className="ml-1 size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button type="button" variant="outline" onClick={() => reset(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                reset(false);
                navigate("/app/rapid-router");
              }}
            >
              Open Rapid Router
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
