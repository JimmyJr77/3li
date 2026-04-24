/**
 * Maps common Brand Rep model mistakes into the shape `normalizeBrandProfile` / the UI expect.
 * (Top-level mission/vision, identity aliases, single-key wrappers, etc.)
 */
export function coerceBrandProfilePatch(patch: Record<string, unknown>): Record<string, unknown> {
  let o: Record<string, unknown> = { ...patch };

  for (const wrap of ["brandProfile", "brandKit", "kit", "profile", "draft"]) {
    const keys = Object.keys(o);
    if (keys.length === 1 && keys[0] === wrap) {
      const inner = o[wrap];
      if (inner && typeof inner === "object" && !Array.isArray(inner)) {
        o = { ...(inner as Record<string, unknown>) };
      }
      break;
    }
  }

  const out: Record<string, unknown> = { ...o };

  const takeTopString = (...fieldNames: string[]): string | undefined => {
    for (const f of fieldNames) {
      const v = out[f];
      if (typeof v === "string" && v.trim()) {
        delete out[f];
        return v.trim();
      }
    }
    return undefined;
  };

  const nest = (key: string): Record<string, unknown> => {
    const cur = out[key];
    if (cur && typeof cur === "object" && !Array.isArray(cur)) {
      return { ...(cur as Record<string, unknown>) };
    }
    return {};
  };

  // --- purpose (top-level mission/vision are dropped by client normalize if left here) ---
  const purpose = nest("purpose");
  delete out.purpose;
  const mission = takeTopString("mission", "Mission");
  if (mission && purpose.mission === undefined) purpose.mission = mission;
  const vision = takeTopString("vision", "Vision");
  if (vision && purpose.vision === undefined) purpose.vision = vision;
  if (Object.keys(purpose).length) out.purpose = purpose;

  // --- identity (top-level + common wrong keys inside identity) ---
  const identity = nest("identity");
  delete out.identity;
  const displayName =
    takeTopString("displayName", "brandName", "BrandName", "companyName", "brand", "name") ??
    pickNestedStringField(identity, ["brandName", "name", "companyName", "brand", "display_name"]);
  if (displayName && identity.displayName === undefined) identity.displayName = displayName;
  const legalName = takeTopString("legalName", "LegalName") ?? pickNestedStringField(identity, ["company", "legal_entity"]);
  if (legalName && identity.legalName === undefined) identity.legalName = legalName;
  const tagline = takeTopString("tagline", "Tagline", "slogan", "Slogan");
  if (tagline && identity.tagline === undefined) identity.tagline = tagline;
  const industry = takeTopString("industry", "Industry");
  if (industry && identity.industry === undefined) identity.industry = industry;
  if (Object.keys(identity).length) out.identity = identity;

  // --- audience ---
  const audience = nest("audience");
  delete out.audience;
  const summary =
    takeTopString(
      "audienceSummary",
      "audience_summary",
      "idealCustomer",
      "ideal_customer",
      "targetAudience",
      "target_audience",
    ) ?? pickNestedStringField(audience, ["idealCustomer", "summary"]);
  if (summary && audience.summary === undefined) audience.summary = summary;
  const segments = takeTopString("segments", "personas");
  if (segments && audience.segments === undefined) audience.segments = segments;
  const geography = takeTopString("geography", "region");
  if (geography && audience.geography === undefined) audience.geography = geography;
  if (Object.keys(audience).length) out.audience = audience;

  // --- positioning ---
  const positioning = nest("positioning");
  delete out.positioning;
  const category = takeTopString("marketCategory", "market_category", "category");
  if (category && positioning.category === undefined) positioning.category = category;
  const differentiators = takeTopString("differentiators", "differentiator", "valueProps", "value_proposition");
  if (differentiators && positioning.differentiators === undefined) positioning.differentiators = differentiators;
  const competitors = takeTopString("competitors", "competition", "competitiveLandscape");
  if (competitors && positioning.competitors === undefined) positioning.competitors = competitors;
  if (Object.keys(positioning).length) out.positioning = positioning;

  // --- channels (sometimes nested as { text } ) ---
  if (out.channels && typeof out.channels === "object" && !Array.isArray(out.channels)) {
    const ch = out.channels as Record<string, unknown>;
    const t = typeof ch.text === "string" ? ch.text.trim() : typeof ch.value === "string" ? ch.value.trim() : "";
    if (t) out.channels = t;
  }

  const ag = out.aiBrandGuidance;
  const agStr = typeof ag === "string" ? ag.trim() : "";
  if (!agStr && typeof out.aiBrandContext === "string" && out.aiBrandContext.trim()) {
    out.aiBrandGuidance = out.aiBrandContext.trim();
    delete out.aiBrandContext;
  }

  return out;
}

function pickNestedStringField(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) {
      delete obj[k];
      return v.trim();
    }
  }
  return undefined;
}
