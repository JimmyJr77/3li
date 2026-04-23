/** Mirrors server `brandProfileFormat` — one kit per brand (engagement / client context). */
export type BrandProfile = {
  identity?: {
    displayName?: string;
    legalName?: string;
    tagline?: string;
    industry?: string;
  };
  purpose?: {
    mission?: string;
    vision?: string;
  };
  /** Short value statements */
  values?: string[];
  audience?: {
    summary?: string;
    segments?: string;
    geography?: string;
  };
  positioning?: {
    category?: string;
    differentiators?: string;
    competitors?: string;
  };
  voice?: {
    personality?: string;
    dos?: string;
    donts?: string;
    vocabulary?: string;
  };
  visual?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    typographyNotes?: string;
  };
  goals?: {
    business?: string;
    marketing?: string;
    metrics?: string;
  };
  messaging?: {
    keyMessages?: string;
    proofPoints?: string;
  };
  story?: {
    origin?: string;
    socialProof?: string;
  };
  /** Freeform: channels, touchpoints, campaigns */
  channels?: string;
  legal?: {
    trademark?: string;
    disclaimers?: string;
  };
  assets?: {
    logoPrimaryNote?: string;
    logoSecondaryNote?: string;
    photoDirection?: string;
    /** Optional data URL — keep small; used for preview + “logo present” signal */
    logoPrimaryDataUrl?: string;
  };
};

export function emptyBrandProfile(): BrandProfile {
  return {
    identity: {},
    purpose: {},
    values: [],
    audience: {},
    positioning: {},
    voice: {},
    visual: {},
    goals: {},
    messaging: {},
    story: {},
    channels: "",
    legal: {},
    assets: {},
  };
}

export function normalizeBrandProfile(raw: unknown): BrandProfile {
  const base = emptyBrandProfile();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  return {
    identity: { ...base.identity, ...(typeof o.identity === "object" && o.identity && !Array.isArray(o.identity) ? o.identity : {}) },
    purpose: { ...base.purpose, ...(typeof o.purpose === "object" && o.purpose && !Array.isArray(o.purpose) ? o.purpose : {}) },
    values: Array.isArray(o.values) ? o.values.filter((x): x is string => typeof x === "string") : base.values,
    audience: { ...base.audience, ...(typeof o.audience === "object" && o.audience && !Array.isArray(o.audience) ? o.audience : {}) },
    positioning: {
      ...base.positioning,
      ...(typeof o.positioning === "object" && o.positioning && !Array.isArray(o.positioning) ? o.positioning : {}),
    },
    voice: { ...base.voice, ...(typeof o.voice === "object" && o.voice && !Array.isArray(o.voice) ? o.voice : {}) },
    visual: { ...base.visual, ...(typeof o.visual === "object" && o.visual && !Array.isArray(o.visual) ? o.visual : {}) },
    goals: { ...base.goals, ...(typeof o.goals === "object" && o.goals && !Array.isArray(o.goals) ? o.goals : {}) },
    messaging: { ...base.messaging, ...(typeof o.messaging === "object" && o.messaging && !Array.isArray(o.messaging) ? o.messaging : {}) },
    story: { ...base.story, ...(typeof o.story === "object" && o.story && !Array.isArray(o.story) ? o.story : {}) },
    channels: typeof o.channels === "string" ? o.channels : base.channels,
    legal: { ...base.legal, ...(typeof o.legal === "object" && o.legal && !Array.isArray(o.legal) ? o.legal : {}) },
    assets: { ...base.assets, ...(typeof o.assets === "object" && o.assets && !Array.isArray(o.assets) ? o.assets : {}) },
  };
}
