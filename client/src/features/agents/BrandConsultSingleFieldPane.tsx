import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import {
  consultFieldEntry,
  getConsultFieldValue,
  setConsultFieldValue,
  type ConsultFieldId,
} from "@/features/agents/brandConsultFields";
import type { BrandProfile } from "@/features/brand/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const textareaClass =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full min-h-[100px] resize-y rounded-lg border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const SINGLE_LINE_IDS = new Set<string>([
  "identity.displayName",
  "identity.industry",
  "identity.legalName",
  "identity.tagline",
  "audience.geography",
  "positioning.category",
  "visual.primaryColor",
  "visual.secondaryColor",
  "visual.accentColor",
]);

type BrandConsultSingleFieldPaneProps = {
  fieldId: ConsultFieldId | string;
  profile: BrandProfile;
  setProfile: Dispatch<SetStateAction<BrandProfile>>;
};

/** One kit field editor for field-by-field Brand Rep walk (working draft). */
export function BrandConsultSingleFieldPane({ fieldId, profile, setProfile }: BrandConsultSingleFieldPaneProps) {
  const entry = consultFieldEntry(fieldId);
  const label = entry?.label ?? fieldId;
  const value = getConsultFieldValue(profile, fieldId);

  const onStr = (next: string) => setProfile((p) => setConsultFieldValue(p, fieldId, next));

  if (fieldId === "visual.primaryColor" || fieldId === "visual.secondaryColor" || fieldId === "visual.accentColor") {
    const key = fieldId.split(".")[1] as "primaryColor" | "secondaryColor" | "accentColor";
    const hex = profile.visual?.[key];
    const pickerValue = hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#6366f1";
    return (
      <div className="space-y-2 p-1">
        <Label className="text-foreground">{label}</Label>
        <div className="flex gap-2">
          <Input
            className="font-mono text-xs"
            value={value}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onStr(e.target.value)}
          />
          <input
            type="color"
            aria-label={`Pick ${key}`}
            className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
            value={pickerValue}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onStr(e.target.value)}
          />
        </div>
      </div>
    );
  }

  if (SINGLE_LINE_IDS.has(fieldId)) {
    return (
      <div className="space-y-2 p-1">
        <Label className="text-foreground">{label}</Label>
        <Input value={value} onChange={(e: ChangeEvent<HTMLInputElement>) => onStr(e.target.value)} />
      </div>
    );
  }

  return (
    <div className="space-y-2 p-1">
      <Label className="text-foreground">{label}</Label>
      <textarea
        className={textareaClass}
        rows={fieldId === "values" ? 6 : 5}
        value={value}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onStr(e.target.value)}
      />
    </div>
  );
}
