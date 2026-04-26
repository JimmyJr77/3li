export type BoardTemplateList = { title: string; key: string | null };

export type BoardTemplate = {
  id: string;
  name: string;
  description: string;
  lists: BoardTemplateList[];
};

/** In-memory templates for `POST .../boards/from-template` (no DB table yet). */
export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "single_list",
    name: "Single list",
    description: "One sub-board; use the built-in ticket tracker for brainstorm → done.",
    lists: [{ title: "Tasks", key: "backlog" }],
  },
  {
    id: "marketing_growth",
    name: "Marketing & brand",
    description: "Sub-boards for growth workstreams; tickets move on status inside each sub-board.",
    lists: [
      { title: "Content & editorial", key: "backlog" },
      { title: "Campaigns", key: null },
      { title: "Community & social", key: null },
      { title: "Web & lifecycle", key: null },
      { title: "Product marketing & GTM", key: null },
    ],
  },
  {
    id: "product_program",
    name: "Product & program",
    description: "Program lanes across discovery, delivery, and go-to-market.",
    lists: [
      { title: "Discovery & research", key: "backlog" },
      { title: "Portfolio & roadmap", key: null },
      { title: "Build & delivery", key: null },
      { title: "Launches & releases", key: null },
      { title: "Feedback & insights", key: null },
    ],
  },
  {
    id: "customer_revenue",
    name: "Customer & revenue",
    description: "Revenue and customer life cycle across several lines of effort.",
    lists: [
      { title: "Pipeline & sales", key: "backlog" },
      { title: "Onboarding", key: null },
      { title: "Success & adoption", key: null },
      { title: "Support & issues", key: null },
      { title: "Growth & renewals", key: null },
    ],
  },
  {
    id: "people_org",
    name: "People & org",
    description: "HR, development, and internal culture as parallel tracks.",
    lists: [
      { title: "Hiring", key: "backlog" },
      { title: "People operations", key: null },
      { title: "Learning & development", key: null },
      { title: "Internal comms", key: null },
      { title: "Culture & engagement", key: null },
    ],
  },
  {
    id: "business_operations",
    name: "Business & operations",
    description: "Cross-functional ops: money, risk, vendors, and workplace systems.",
    lists: [
      { title: "Finance & reporting", key: "backlog" },
      { title: "Legal & risk", key: null },
      { title: "Vendors & procurement", key: null },
      { title: "Workplace & systems", key: null },
      { title: "Strategic initiatives", key: null },
    ],
  },
];

export const DEFAULT_TEMPLATE_LABELS = [
  { name: "Bug", color: "#ef4444" },
  { name: "Feature", color: "#22c55e" },
  { name: "Chore", color: "#64748b" },
] as const;
