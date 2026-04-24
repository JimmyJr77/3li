import { z } from "zod";

const text = z.string().max(80_000).optional();

/** Same shape as server — validate before save in the Brand Center UI. */
export const brandProfileSchema = z
  .union([
    z.null(),
    z
      .object({
        identity: z
          .object({
            displayName: text,
            legalName: text,
            tagline: text,
            industry: text,
          })
          .partial()
          .optional(),
        purpose: z
          .object({
            mission: text,
            vision: text,
          })
          .partial()
          .optional(),
        values: z.array(z.string().max(2000)).max(200).optional(),
        audience: z
          .object({
            summary: text,
            segments: text,
            geography: text,
          })
          .partial()
          .optional(),
        positioning: z
          .object({
            category: text,
            differentiators: text,
            competitors: text,
          })
          .partial()
          .optional(),
        voice: z
          .object({
            personality: text,
            dos: text,
            donts: text,
            vocabulary: text,
          })
          .partial()
          .optional(),
        visual: z
          .object({
            primaryColor: text,
            secondaryColor: text,
            accentColor: text,
            typographyNotes: text,
          })
          .partial()
          .optional(),
        goals: z
          .object({
            business: text,
            marketing: text,
            metrics: text,
          })
          .partial()
          .optional(),
        messaging: z
          .object({
            keyMessages: text,
            proofPoints: text,
          })
          .partial()
          .optional(),
        story: z
          .object({
            origin: text,
            socialProof: text,
          })
          .partial()
          .optional(),
        channels: text,
        legal: z
          .object({
            trademark: text,
            disclaimers: text,
          })
          .partial()
          .optional(),
        assets: z
          .object({
            logoPrimaryNote: text,
            logoSecondaryNote: text,
            photoDirection: text,
            logoPrimaryDataUrl: z.string().max(500_000).optional(),
          })
          .partial()
          .optional(),
        otherBrandConsiderations: text,
        aiBrandGuidance: text,
      })
      .passthrough(),
  ])
  .refine((val) => val === null || JSON.stringify(val).length <= 900_000, {
    message: "BRAND_PROFILE_TOO_LARGE",
  });
