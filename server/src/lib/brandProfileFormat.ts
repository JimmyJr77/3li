import type { Prisma } from "@prisma/client";

const MAX_INLINE_CHARS = 14_000;

function trimBlock(s: string): string {
  const t = s.trim();
  if (t.length <= MAX_INLINE_CHARS) return t;
  return `${t.slice(0, MAX_INLINE_CHARS)}\n…(truncated)`;
}

function line(label: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return `${label}: ${value ? "yes" : "no"}`;
  if (typeof value === "number" && Number.isFinite(value)) return `${label}: ${value}`;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    return `${label}: ${t}`;
  }
  if (Array.isArray(value)) {
    const parts = value.filter((x) => typeof x === "string" && x.trim()).map((x) => (x as string).trim());
    if (!parts.length) return null;
    return `${label}: ${parts.join("; ")}`;
  }
  return null;
}

/**
 * Turns stored Brand.brandProfile JSON into a compact block for LLM system prompts.
 */
export function formatBrandProfileForPrompt(brandProfile: Prisma.JsonValue | null | undefined): string {
  if (brandProfile === null || brandProfile === undefined) return "";
  if (typeof brandProfile !== "object" || Array.isArray(brandProfile)) {
    return "";
  }
  const o = brandProfile as Record<string, unknown>;
  const lines: string[] = [];

  const id = o.identity && typeof o.identity === "object" && !Array.isArray(o.identity) ? (o.identity as Record<string, unknown>) : {};
  const purpose = o.purpose && typeof o.purpose === "object" && !Array.isArray(o.purpose) ? (o.purpose as Record<string, unknown>) : {};
  const audience = o.audience && typeof o.audience === "object" && !Array.isArray(o.audience) ? (o.audience as Record<string, unknown>) : {};
  const positioning =
    o.positioning && typeof o.positioning === "object" && !Array.isArray(o.positioning) ? (o.positioning as Record<string, unknown>) : {};
  const voice = o.voice && typeof o.voice === "object" && !Array.isArray(o.voice) ? (o.voice as Record<string, unknown>) : {};
  const visual = o.visual && typeof o.visual === "object" && !Array.isArray(o.visual) ? (o.visual as Record<string, unknown>) : {};
  const goals = o.goals && typeof o.goals === "object" && !Array.isArray(o.goals) ? (o.goals as Record<string, unknown>) : {};
  const messaging = o.messaging && typeof o.messaging === "object" && !Array.isArray(o.messaging) ? (o.messaging as Record<string, unknown>) : {};
  const story = o.story && typeof o.story === "object" && !Array.isArray(o.story) ? (o.story as Record<string, unknown>) : {};
  const legal = o.legal && typeof o.legal === "object" && !Array.isArray(o.legal) ? (o.legal as Record<string, unknown>) : {};
  const assets = o.assets && typeof o.assets === "object" && !Array.isArray(o.assets) ? (o.assets as Record<string, unknown>) : {};

  const push = (x: string | null) => {
    if (x) lines.push(x);
  };

  push(line("Brand / display name", id.displayName));
  push(line("Legal name", id.legalName));
  push(line("Tagline", id.tagline));
  push(line("Industry / category", id.industry));

  push(line("Mission", purpose.mission));
  push(line("Vision", purpose.vision));
  push(line("Values", o.values));

  push(line("Audience summary", audience.summary));
  push(line("Segments", audience.segments));
  push(line("Geography", audience.geography));

  push(line("Market category", positioning.category));
  push(line("Differentiators", positioning.differentiators));
  push(line("Competitive landscape", positioning.competitors));

  push(line("Voice & personality", voice.personality));
  push(line("Voice — do", voice.dos));
  push(line("Voice — don't", voice.donts));
  push(line("Vocabulary & phrases", voice.vocabulary));

  push(line("Primary color", visual.primaryColor));
  push(line("Secondary color", visual.secondaryColor));
  push(line("Accent color", visual.accentColor));
  push(line("Typography & layout notes", visual.typographyNotes));

  push(line("Business goals", goals.business));
  push(line("Marketing goals", goals.marketing));
  push(line("Success metrics", goals.metrics));

  push(line("Key messages", messaging.keyMessages));
  push(line("Proof points", messaging.proofPoints));

  push(line("Origin / story", story.origin));
  push(line("Social proof", story.socialProof));

  push(line("Channels & touchpoints", o.channels));

  push(line("Trademark / usage notes", legal.trademark));
  push(line("Disclaimers", legal.disclaimers));

  push(line("Logo / wordmark notes (primary)", assets.logoPrimaryNote));
  push(line("Logo / lockup notes (secondary)", assets.logoSecondaryNote));
  push(line("Photography / imagery direction", assets.photoDirection));

  const hasLogoData =
    typeof assets.logoPrimaryDataUrl === "string" &&
    assets.logoPrimaryDataUrl.startsWith("data:image/") &&
    assets.logoPrimaryDataUrl.length > 40;
  if (hasLogoData) {
    push("Primary logo: image attached in brand kit (use brand notes above; do not invent visual details not described in text).");
  }

  if (!lines.length) return "";
  return trimBlock(`## Company brand kit (authoritative for this workspace)\n${lines.map((l) => `• ${l}`).join("\n")}`);
}

