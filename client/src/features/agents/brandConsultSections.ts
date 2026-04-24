/** Shared with Brand Rep consultation UI and server `consultSectionId` values. */
export const CONSULT_SECTIONS = [
  { id: "discovery", label: "Discovery" },
  { id: "identity_structure", label: "Identity & structure" },
  { id: "purpose_mission", label: "Purpose & mission" },
  { id: "audience_positioning", label: "Audience & positioning" },
  { id: "voice_comms", label: "Voice & DNA" },
  { id: "messaging_narrative", label: "Messaging & story" },
  { id: "visual_system", label: "Visual system" },
  { id: "goals_and_metrics", label: "Goals & metrics" },
  { id: "gtm_cx", label: "Go-to-market & CX" },
  { id: "partners_ecosystem_ops", label: "Partners & operations" },
  { id: "governance_risk_legal", label: "Governance & risk" },
  { id: "assets_logos", label: "Logos & imagery" },
  { id: "other_considerations", label: "Other considerations" },
  { id: "recap", label: "Recap" },
] as const;

export type ConsultSectionId = (typeof CONSULT_SECTIONS)[number]["id"];
