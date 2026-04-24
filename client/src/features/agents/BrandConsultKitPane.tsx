import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from "react";
import type { ConsultSectionId } from "@/features/agents/brandConsultSections";
import { CONSULT_SECTIONS } from "@/features/agents/brandConsultSections";
import type { BrandProfile } from "@/features/brand/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const textareaClass =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full min-h-[72px] resize-y rounded-lg border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type BrandConsultKitPaneProps = {
  sectionId: ConsultSectionId;
  profile: BrandProfile;
  setProfile: Dispatch<SetStateAction<BrandProfile>>;
};

/**
 * Mirrors the active Brand OS consultation step — only the fields for that step so the user can edit
 * alongside the agent. Same state as Brand Center (live draft).
 */
export function BrandConsultKitPane({ sectionId, profile, setProfile }: BrandConsultKitPaneProps) {
  const label = CONSULT_SECTIONS.find((s) => s.id === sectionId)?.label ?? sectionId;

  if (sectionId === "recap") {
    return (
      <div className="space-y-2 p-1 text-sm leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Recap</p>
        <p>
          This step is conversation-only. Scroll the main Brand Center page to review all sections — your edits are
          already there.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-1">
      <div>
        <h2 className="text-base font-semibold text-foreground">{label}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Edit fields here; they update the Brand Center kit immediately. Use the main page for uploads (e.g. logo) or
          long-form sections not shown in this step.
        </p>
      </div>

      {sectionId === "discovery" ? (
        <>
          <Field label="Display / brand name">
            <Input
              value={profile.identity?.displayName ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setProfile((p) => ({
                  ...p,
                  identity: { ...p.identity, displayName: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Industry / category">
            <Input
              value={profile.identity?.industry ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setProfile((p) => ({
                  ...p,
                  identity: { ...p.identity, industry: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Ideal customer / audience summary">
            <textarea
              className={textareaClass}
              rows={3}
              value={profile.audience?.summary ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  audience: { ...p.audience, summary: e.target.value },
                }))
              }
            />
          </Field>
        </>
      ) : null}

      {sectionId === "identity_structure" ? (
        <>
          <Field label="Display / brand name">
            <Input
              value={profile.identity?.displayName ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setProfile((p) => ({
                  ...p,
                  identity: { ...p.identity, displayName: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Legal entity name">
            <Input
              value={profile.identity?.legalName ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setProfile((p) => ({
                  ...p,
                  identity: { ...p.identity, legalName: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={profile.identity?.tagline ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setProfile((p) => ({
                  ...p,
                  identity: { ...p.identity, tagline: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Industry / category">
            <Input
              value={profile.identity?.industry ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setProfile((p) => ({
                  ...p,
                  identity: { ...p.identity, industry: e.target.value },
                }))
              }
            />
          </Field>
        </>
      ) : null}

      {sectionId === "purpose_mission" ? (
        <>
          <Field label="Mission">
            <textarea
              className={textareaClass}
              rows={3}
              value={profile.purpose?.mission ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  purpose: { ...p.purpose, mission: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Vision">
            <textarea
              className={textareaClass}
              rows={3}
              value={profile.purpose?.vision ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  purpose: { ...p.purpose, vision: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Values" hint="One per line.">
            <textarea
              className={textareaClass}
              rows={4}
              value={(profile.values ?? []).join("\n")}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  values: e.target.value
                    .split("\n")
                    .map((s: string) => s.trim())
                    .filter(Boolean),
                }))
              }
            />
          </Field>
        </>
      ) : null}

      {sectionId === "audience_positioning" ? (
        <>
          <Field label="Ideal customer / audience summary">
            <textarea
              className={textareaClass}
              rows={3}
              value={profile.audience?.summary ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  audience: { ...p.audience, summary: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Segments or personas">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.audience?.segments ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  audience: { ...p.audience, segments: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Geography / markets">
            <Input
              value={profile.audience?.geography ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setProfile((p) => ({
                  ...p,
                  audience: { ...p.audience, geography: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Market category">
            <Input
              value={profile.positioning?.category ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setProfile((p) => ({
                  ...p,
                  positioning: { ...p.positioning, category: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Differentiators">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.positioning?.differentiators ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  positioning: { ...p.positioning, differentiators: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Competitive landscape">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.positioning?.competitors ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  positioning: { ...p.positioning, competitors: e.target.value },
                }))
              }
            />
          </Field>
        </>
      ) : null}

      {sectionId === "voice_comms" ? (
        <>
          <Field label="Personality">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.voice?.personality ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  voice: { ...p.voice, personality: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Values" hint="One per line.">
            <textarea
              className={textareaClass}
              rows={3}
              value={(profile.values ?? []).join("\n")}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  values: e.target.value
                    .split("\n")
                    .map((s: string) => s.trim())
                    .filter(Boolean),
                }))
              }
            />
          </Field>
          <Field label="Do">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.voice?.dos ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  voice: { ...p.voice, dos: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Don't">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.voice?.donts ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  voice: { ...p.voice, donts: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Vocabulary & phrases">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.voice?.vocabulary ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  voice: { ...p.voice, vocabulary: e.target.value },
                }))
              }
            />
          </Field>
        </>
      ) : null}

      {sectionId === "messaging_narrative" ? (
        <>
          <Field label="Tagline">
            <Input
              value={profile.identity?.tagline ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setProfile((p) => ({
                  ...p,
                  identity: { ...p.identity, tagline: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Key messages / pillars">
            <textarea
              className={textareaClass}
              rows={3}
              value={profile.messaging?.keyMessages ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  messaging: { ...p.messaging, keyMessages: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Proof points">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.messaging?.proofPoints ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  messaging: { ...p.messaging, proofPoints: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Origin / narrative">
            <textarea
              className={textareaClass}
              rows={3}
              value={profile.story?.origin ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  story: { ...p.story, origin: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Social proof">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.story?.socialProof ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  story: { ...p.story, socialProof: e.target.value },
                }))
              }
            />
          </Field>
        </>
      ) : null}

      {sectionId === "visual_system" ? (
        <>
          {(["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => {
            const hex = profile.visual?.[key];
            const pickerValue = hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#6366f1";
            return (
              <Field key={key} label={key === "primaryColor" ? "Primary color" : key === "secondaryColor" ? "Secondary" : "Accent"}>
                <div className="flex gap-2">
                  <Input
                    className="font-mono text-xs"
                    value={profile.visual?.[key] ?? ""}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setProfile((p) => ({
                        ...p,
                        visual: { ...p.visual, [key]: e.target.value },
                      }))
                    }
                  />
                  <input
                    type="color"
                    aria-label={`Pick ${key}`}
                    className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                    value={pickerValue}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setProfile((p) => ({
                        ...p,
                        visual: { ...p.visual, [key]: e.target.value },
                      }))
                    }
                  />
                </div>
              </Field>
            );
          })}
          <Field label="Typography & layout notes">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.visual?.typographyNotes ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  visual: { ...p.visual, typographyNotes: e.target.value },
                }))
              }
            />
          </Field>
        </>
      ) : null}

      {sectionId === "goals_and_metrics" ? (
        <>
          <Field label="Business goals">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.goals?.business ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  goals: { ...p.goals, business: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Marketing / brand goals">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.goals?.marketing ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  goals: { ...p.goals, marketing: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Success metrics">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.goals?.metrics ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  goals: { ...p.goals, metrics: e.target.value },
                }))
              }
            />
          </Field>
        </>
      ) : null}

      {sectionId === "gtm_cx" ? (
        <>
          <Field label="Channels & touchpoints">
            <textarea
              className={textareaClass}
              rows={3}
              value={typeof profile.channels === "string" ? profile.channels : ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({ ...p, channels: e.target.value }))
              }
            />
          </Field>
          <Field label="Marketing / brand goals">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.goals?.marketing ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  goals: { ...p.goals, marketing: e.target.value },
                }))
              }
            />
          </Field>
        </>
      ) : null}

      {sectionId === "partners_ecosystem_ops" ? (
        <Field label="Partners, ecosystem & operations">
          <textarea
            className={textareaClass}
            rows={8}
            value={profile.otherBrandConsiderations ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setProfile((p) => ({ ...p, otherBrandConsiderations: e.target.value }))}
            placeholder="Partnerships, internal tools, process notes…"
          />
        </Field>
      ) : null}

      {sectionId === "governance_risk_legal" ? (
        <>
          <Field label="Trademark / usage notes">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.legal?.trademark ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  legal: { ...p.legal, trademark: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Disclaimers">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.legal?.disclaimers ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  legal: { ...p.legal, disclaimers: e.target.value },
                }))
              }
            />
          </Field>
        </>
      ) : null}

      {sectionId === "assets_logos" ? (
        <>
          <Field label="Logo usage notes (for AI)" hint="Upload the logo on the main Brand Center page.">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.assets?.logoPrimaryNote ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  assets: { ...p.assets, logoPrimaryNote: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Secondary / icon lockup notes">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.assets?.logoSecondaryNote ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  assets: { ...p.assets, logoSecondaryNote: e.target.value },
                }))
              }
            />
          </Field>
          <Field label="Photography / illustration direction">
            <textarea
              className={textareaClass}
              rows={2}
              value={profile.assets?.photoDirection ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setProfile((p) => ({
                  ...p,
                  assets: { ...p.assets, photoDirection: e.target.value },
                }))
              }
            />
          </Field>
        </>
      ) : null}

      {sectionId === "other_considerations" ? (
        <Field label="Other brand considerations">
          <textarea
            className={textareaClass}
            rows={8}
            value={profile.otherBrandConsiderations ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setProfile((p) => ({ ...p, otherBrandConsiderations: e.target.value }))}
          />
        </Field>
      ) : null}
    </div>
  );
}
