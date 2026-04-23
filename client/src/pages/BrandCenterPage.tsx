import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Goal, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { fetchBrandKitAiText, fetchBrandProfile, saveBrandProfile } from "@/features/brand/api";
import {
  loadRapidRouterBrandEntries,
  removeRapidRouterBrandEntry,
} from "@/features/brand/brandKitContext";
import { brandProfileSchema } from "@/features/brand/schema";
import {
  type BrandProfile,
  emptyBrandProfile,
  normalizeBrandProfile,
} from "@/features/brand/types";
import { useActiveWorkspace } from "@/context/ActiveWorkspaceContext";
import { BrandRepAgentSheet } from "@/features/agents/BrandRepAgentSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const textareaClass =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full min-h-[80px] resize-y rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const MAX_LOGO_FILE_BYTES = 380_000;

function CollapsibleSection({
  title,
  description,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-border bg-card shadow-xs [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="cursor-pointer list-none px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <span className="text-xs font-medium text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
        </div>
      </summary>
      <div className="space-y-4 border-t border-border px-5 pb-5 pt-2">{children}</div>
    </details>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function BrandCenterPage() {
  const qc = useQueryClient();
  const { activeWorkspaceId, isLoading: wsLoading } = useActiveWorkspace();
  const workspaceId = activeWorkspaceId;

  const [profile, setProfile] = useState<BrandProfile>(() => emptyBrandProfile());
  const [rapidInboxTick, setRapidInboxTick] = useState(0);
  const baselineRef = useRef<string>("");

  const rapidEntries = useMemo(
    () => loadRapidRouterBrandEntries(workspaceId),
    [rapidInboxTick, workspaceId],
  );

  useEffect(() => {
    if (!workspaceId) return;
    void qc.prefetchQuery({
      queryKey: ["brand-kit-ai-text", workspaceId],
      queryFn: () => fetchBrandKitAiText(workspaceId),
    });
  }, [workspaceId, qc]);

  const profileQuery = useQuery({
    queryKey: ["brand-profile", workspaceId],
    queryFn: () => fetchBrandProfile(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    if (!profileQuery.isSuccess || !workspaceId) return;
    const raw = profileQuery.data?.brandProfile;
    const next = raw ? normalizeBrandProfile(raw) : emptyBrandProfile();
    setProfile(next);
    baselineRef.current = JSON.stringify(next);
  }, [profileQuery.isSuccess, profileQuery.data, workspaceId]);

  const dirty = useMemo(() => JSON.stringify(profile) !== baselineRef.current, [profile]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const r = brandProfileSchema.safeParse(profile);
      if (!r.success) {
        window.alert(r.error.issues[0]?.message ?? "Check brand fields before saving.");
        return Promise.reject(new Error("validation"));
      }
      return saveBrandProfile(workspaceId!, normalizeBrandProfile(r.data));
    },
    onSuccess: (data) => {
      const n = data.brandProfile ? normalizeBrandProfile(data.brandProfile) : emptyBrandProfile();
      baselineRef.current = JSON.stringify(n);
      setProfile(n);
      qc.setQueryData(["brand-profile", workspaceId], data);
      void qc.invalidateQueries({ queryKey: ["brand-kit-ai-text", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const update = useCallback(<K extends keyof BrandProfile>(key: K, val: BrandProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: val }));
  }, []);

  return (
    <div className="flex w-full min-w-0 flex-col gap-8 pb-16">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Goal className="size-7 shrink-0 text-muted-foreground" aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight">Brand Center</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Define your company&apos;s brand identity so AI across 3LI — chat, notes, Brainstorm, and more — stays on-message.
            This kit is the source of truth for the active brand: it applies across that brand&apos;s whole workspace
            (boards, tasks, notebooks, and more), not the other way around.
          </p>
        </div>
        {workspaceId ? (
          <div className="shrink-0 pt-1">
            <BrandRepAgentSheet
              workspaceId={workspaceId}
              brandProfile={profile}
              onApplyProfilePatch={(next) => setProfile(next)}
            />
          </div>
        ) : null}
      </div>

      <CollapsibleSection
        title="Your brand and workspace"
        description="How Brand Center lines up with the sidebar and delivery work."
        defaultOpen
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Use <strong className="font-medium text-foreground">My brands</strong> in the sidebar to switch which client or
          company you are working for. The name shown prefers your{" "}
          <strong className="font-medium text-foreground">Display / brand name</strong> from this kit when saved; otherwise
          it uses the workspace name. Each row is one <strong className="font-medium text-foreground">brand</strong> with
          a single <strong className="font-medium text-foreground">workspace</strong> (the full ecosystem for that client).{" "}
          <strong className="font-medium text-foreground">Project spaces</strong> inside the workspace group project boards
          and related delivery work; this kit applies to the whole brand workspace.
        </p>
      </CollapsibleSection>

      {wsLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      )}

      {!wsLoading && !workspaceId && (
        <p className="text-sm text-muted-foreground">
          Add a brand in Settings first — then you can save your brand kit here.
        </p>
      )}

      {workspaceId && profileQuery.isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading brand kit…
        </div>
      )}

      {profileQuery.isError && (
        <p className="text-sm text-destructive">Could not load brand profile. Check your connection and try again.</p>
      )}

      {workspaceId && profileQuery.isSuccess && (
        <div className="flex flex-col gap-6">
          <CollapsibleSection
            title="Core identity"
            description="How the brand introduces itself — names, tagline, and sector."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Display / brand name">
                <Input
                  value={profile.identity?.displayName ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setProfile((p) => ({
                      ...p,
                      identity: { ...p.identity, displayName: e.target.value },
                    }))
                  }
                  placeholder="e.g. Northwind Analytics"
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
                  placeholder="Optional"
                />
              </Field>
            </div>
            <Field label="Tagline">
              <Input
                value={profile.identity?.tagline ?? ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setProfile((p) => ({
                    ...p,
                    identity: { ...p.identity, tagline: e.target.value },
                  }))
                }
                placeholder="Short promise or motto"
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
                placeholder="e.g. B2B SaaS · Healthcare IT"
              />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="Purpose" description="Mission, vision, and principles that anchor decisions.">
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
                placeholder="Why you exist today."
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
                placeholder="The future you are building toward."
              />
            </Field>
            <Field label="Values" hint="One per line.">
              <textarea
                  className={textareaClass}
                rows={4}
                value={(profile.values ?? []).join("\n")}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  update(
                    "values",
                    e.target.value
                      .split("\n")
                      .map((s: string) => s.trim())
                      .filter(Boolean),
                  )
                }
                placeholder={"One per line, e.g. Customer first"}
              />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="Audience & positioning" description="Who you serve and how you win.">
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
                rows={3}
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
                rows={3}
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
                placeholder="Who you’re compared to — not for trash talk, for clarity."
              />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="Voice & tone" description="How the brand sounds in writing and speech.">
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
                placeholder="e.g. Confident, plainspoken, occasionally witty"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Do">
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={profile.voice?.dos ?? ""}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setProfile((p) => ({
                      ...p,
                      voice: { ...p.voice, dos: e.target.value },
                    }))
                  }
                  placeholder="Preferred patterns, words, cadence"
                />
              </Field>
              <Field label="Don't">
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={profile.voice?.donts ?? ""}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setProfile((p) => ({
                      ...p,
                      voice: { ...p.voice, donts: e.target.value },
                    }))
                  }
                  placeholder="Avoid clichés, jargon, or tones"
                />
              </Field>
            </div>
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
                placeholder="Terms to use or avoid; product names"
              />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="Visual system" description="Colors and type — reference for AI-assisted content and decks.">
            <div className="grid gap-4 sm:grid-cols-3">
              {(["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => (
                <Field key={key} label={key === "primaryColor" ? "Primary" : key === "secondaryColor" ? "Secondary" : "Accent"}>
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
                      placeholder="#0F172A"
                    />
                    <input
                      type="color"
                      aria-label={`Pick ${key}`}
                      className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                      value={/^#[0-9a-f]{6}$/i.test(profile.visual?.[key] ?? "") ? profile.visual![key]! : "#6366f1"}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setProfile((p) => ({
                          ...p,
                          visual: { ...p.visual, [key]: e.target.value },
                        }))
                      }
                    />
                  </div>
                </Field>
              ))}
            </div>
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
                placeholder="Fonts, spacing, grid — whatever your team agrees on"
              />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="Goals & outcomes" description="What success looks like — business and brand metrics.">
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
                placeholder="KPIs, leading indicators, review cadence"
              />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="Messaging & proof" description="Claims you can stand behind.">
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
            <Field label="Proof points (stats, logos, awards)">
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
                placeholder="Testimonials, case studies, community"
              />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="Channels & legal" description="Where the brand shows up and compliance guardrails.">
            <Field label="Channels & touchpoints">
              <textarea
                  className={textareaClass}
                rows={2}
                value={typeof profile.channels === "string" ? profile.channels : ""}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => update("channels", e.target.value)}
                placeholder="Site, LinkedIn, events, retail…"
              />
            </Field>
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
          </CollapsibleSection>

          <CollapsibleSection
            title="Logos & imagery"
            description="Upload a primary logo for reference. Add text notes so AI can reason about usage without vision."
          >
            <Field
              label="Primary logo"
              hint={`PNG or SVG under ~${Math.round(MAX_LOGO_FILE_BYTES / 1024)}KB recommended.`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  className="max-w-sm cursor-pointer"
                  onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > MAX_LOGO_FILE_BYTES) {
                      window.alert(`File too large. Use an image under ${Math.round(MAX_LOGO_FILE_BYTES / 1024)}KB.`);
                      e.target.value = "";
                      return;
                    }
                    const dataUrl = await new Promise<string>((resolve, reject) => {
                      const r = new FileReader();
                      r.onload = () => resolve(String(r.result));
                      r.onerror = () => reject(new Error("read"));
                      r.readAsDataURL(file);
                    });
                    setProfile((p) => ({
                      ...p,
                      assets: { ...p.assets, logoPrimaryDataUrl: dataUrl },
                    }));
                  }}
                />
                {profile.assets?.logoPrimaryDataUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setProfile((p) => ({
                        ...p,
                        assets: { ...p.assets, logoPrimaryDataUrl: undefined },
                      }))
                    }
                  >
                    Remove image
                  </Button>
                ) : null}
              </div>
              {profile.assets?.logoPrimaryDataUrl ? (
                <img
                  src={profile.assets.logoPrimaryDataUrl}
                  alt="Primary logo preview"
                  className="mt-3 max-h-24 max-w-[280px] object-contain"
                />
              ) : null}
            </Field>
            <Field label="Logo usage notes (for AI)">
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
                placeholder="Clear space, minimum size, color variants…"
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
          </CollapsibleSection>

          <CollapsibleSection
            title="Other brand considerations"
            description="Anything that should influence the brand and AI outputs but does not fit the sections above — sensitivities, naming constraints, partnerships, regulatory notes, or internal context. You or the Brand Rep Agent can maintain this."
            defaultOpen={false}
          >
            <Field
              label="Additional considerations"
              hint="Optional. Shown to AI with the rest of the kit. The Brand Rep consultation includes a step for this block."
            >
              <textarea
                className={textareaClass}
                rows={5}
                value={profile.otherBrandConsiderations ?? ""}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => update("otherBrandConsiderations", e.target.value)}
                placeholder="e.g. Avoid comparing to Acme Corp by name · Board prefers “clients” not “customers” · EU claims require legal sign-off…"
              />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection
            title="Rapid Router inbox (this device)"
            description="Quick brand notes from Rapid Router. Promote into key messages or remove after you have captured them in the kit."
            defaultOpen={false}
          >
            {rapidEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No local captures yet — send text to Brand Center from Rapid Router.
              </p>
            ) : (
              <ul className="space-y-3">
                {rapidEntries.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm sm:flex-row sm:items-start sm:justify-between"
                  >
                    <p className="whitespace-pre-wrap text-foreground">{e.text}</p>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const prev = profile.messaging?.keyMessages ?? "";
                          const next = prev.trim() ? `${prev.trim()}\n\n${e.text.trim()}` : e.text.trim();
                          setProfile((p) => ({
                            ...p,
                            messaging: { ...p.messaging, keyMessages: next },
                          }));
                        }}
                      >
                        Promote to key messages
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          removeRapidRouterBrandEntry(e.id, workspaceId);
                          setRapidInboxTick((t) => t + 1);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleSection>

          <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
            <Button
              type="button"
              disabled={!dirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="mr-2 size-4" />
                  Save brand kit
                </>
              )}
            </Button>
            {saveMutation.isSuccess && !dirty && !saveMutation.isPending ? (
              <span className="text-sm text-muted-foreground">Saved.</span>
            ) : null}
            {saveMutation.isError ? (
              <span className="text-sm text-destructive">Save failed. Try again.</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
