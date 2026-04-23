import { prisma } from "./db.js";

const SHOWCASE = "Showcase ·";

/** Dev helper: remove prior Showcase rows and re-insert rich demo tasks + brainstorm canvas. */
export async function resetShowcaseDemoData() {
  const workspace = await prisma.workspace.findFirst({
    where: { archivedAt: null },
    orderBy: [{ brand: { position: "asc" } }, { createdAt: "asc" }],
  });
  if (!workspace) return;
  const board = await prisma.board.findFirst({
    where: { projectSpace: { workspaceId: workspace.id }, archivedAt: null },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  if (!board) return;

  await prisma.task.deleteMany({
    where: { list: { boardId: board.id }, title: { startsWith: SHOWCASE } },
  });
  await prisma.ideaEdge.deleteMany({
    where: { id: { contains: "showcase-edge" } },
  });
  await prisma.ideaNode.deleteMany({
    where: {
      OR: [
        { id: { startsWith: "showcase-n" } },
        { id: { contains: "-showcase-n" } },
      ],
    },
  });
  await ensureTaskflowShowcase(board.id);
  const project = await prisma.project.findFirst({
    where: { workspaceId: workspace.id },
  });
  if (project) {
    await ensureBrainstormShowcaseForProject(project.id);
  }
}

/**
 * Rich demo tasks + activity feed for empty boards (or boards without Showcase tasks).
 * Idempotent: skips if any task titled with `Showcase ·` already exists on this board.
 */
export async function ensureTaskflowShowcase(boardId: string) {
  const already = await prisma.task.findFirst({
    where: { list: { boardId }, title: { startsWith: SHOWCASE } },
    select: { id: true },
  });
  if (already) return;

  const lists = await prisma.boardList.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
  });
  const backlog = lists.find((l) => l.key === "backlog");
  const inProg = lists.find((l) => l.key === "in_progress");
  const done = lists.find((l) => l.key === "done");
  if (!backlog || !inProg || !done) return;

  const labels = await prisma.label.findMany({ where: { boardId } });
  const byName = Object.fromEntries(labels.map((l) => [l.name, l.id])) as Record<string, string>;

  type Spec = {
    listKey: "backlog" | "in_progress" | "done";
    title: string;
    description: string;
    priority: string;
    completed?: boolean;
    dueInDays?: number | null;
    label?: keyof typeof byName;
  };

  const specs: Spec[] = [
    {
      listKey: "in_progress",
      title: `${SHOWCASE} Client discovery workshops`,
      description:
        "Facilitate three sessions with stakeholders; capture pain points and success metrics for the engagement.",
      priority: "urgent",
      dueInDays: 3,
      label: "Feature",
    },
    {
      listKey: "in_progress",
      title: `${SHOWCASE} Operating model assessment`,
      description: "Map current decision paths, RACI gaps, and handoffs before recommending target state.",
      priority: "high",
      dueInDays: 7,
      label: "Feature",
    },
    {
      listKey: "backlog",
      title: `${SHOWCASE} Data inventory & lineage`,
      description: "Systems of record, refresh cadence, and PII boundaries for downstream analytics.",
      priority: "high",
      dueInDays: 10,
      label: "Chore",
    },
    {
      listKey: "backlog",
      title: `${SHOWCASE} Competitive landscape brief`,
      description: "Top five alternatives, pricing signals, and differentiation narrative for exec readout.",
      priority: "medium",
      dueInDays: 14,
      label: "Feature",
    },
    {
      listKey: "in_progress",
      title: `${SHOWCASE} Pilot rollout plan`,
      description: "Wave plan, training checkpoints, rollback criteria, and hypercare coverage.",
      priority: "high",
      dueInDays: 5,
      label: "Feature",
    },
    {
      listKey: "backlog",
      title: `${SHOWCASE} Security review packet`,
      description: "Vendor questionnaires, SSO posture, audit logs retention, and incident comms template.",
      priority: "medium",
      dueInDays: 18,
      label: "Bug",
    },
    {
      listKey: "done",
      title: `${SHOWCASE} Kickoff deck & agenda`,
      description: "Signed off by sponsor; circulated to extended team.",
      priority: "medium",
      completed: true,
      dueInDays: -4,
      label: "Chore",
    },
    {
      listKey: "done",
      title: `${SHOWCASE} Stakeholder map v1`,
      description: "Influence/interest grid with owners for each relationship.",
      priority: "low",
      completed: true,
      dueInDays: -7,
      label: "Feature",
    },
    {
      listKey: "backlog",
      title: `${SHOWCASE} ROI model assumptions`,
      description: "Labor savings, revenue uplift scenarios, and sensitivity toggles for steering committee.",
      priority: "medium",
      dueInDays: 21,
      label: "Feature",
    },
    {
      listKey: "in_progress",
      title: `${SHOWCASE} Weekly steering notes`,
      description: "RAG status, decisions requested, and follow-ups with due owners.",
      priority: "high",
      dueInDays: 1,
      label: "Chore",
    },
    {
      listKey: "backlog",
      title: `${SHOWCASE} Change impact workshops`,
      description: "Role-by-role deltas, training needs, and comms calendar for go-live.",
      priority: "low",
      dueInDays: 28,
      label: "Feature",
    },
    {
      listKey: "backlog",
      title: `${SHOWCASE} Integration test checklist`,
      description: "End-to-end cases covering auth, webhooks, failure injection, and observability alerts.",
      priority: "medium",
      dueInDays: 12,
      label: "Bug",
    },
    {
      listKey: "done",
      title: `${SHOWCASE} Success metrics definition`,
      description: "North-star, counter-metrics, and review cadence locked with client.",
      priority: "high",
      completed: true,
      dueInDays: -10,
      label: "Feature",
    },
    {
      listKey: "in_progress",
      title: `${SHOWCASE} Executive readout dry-run`,
      description: "45-minute storyline, appendix deep dives, and Q&A prep with SMEs.",
      priority: "urgent",
      dueInDays: 2,
      label: "Feature",
    },
    {
      listKey: "backlog",
      title: `${SHOWCASE} Handover & sustainment playbook`,
      description: "Runbooks, escalation paths, and capacity model for BAU team.",
      priority: "low",
      dueInDays: 35,
      label: "Chore",
    },
  ];

  const listByKey = { backlog, in_progress: inProg, done };

  await prisma.$transaction(async (tx) => {
    let orderBacklog = 0;
    let orderProg = 0;
    let orderDone = 0;

    for (const spec of specs) {
      const list = listByKey[spec.listKey];
      const order =
        spec.listKey === "backlog" ? orderBacklog++ : spec.listKey === "in_progress" ? orderProg++ : orderDone++;
      const due =
        spec.dueInDays == null
          ? null
          : new Date(Date.now() + spec.dueInDays * 86400000);

      const task = await tx.task.create({
        data: {
          listId: list.id,
          title: spec.title,
          description: spec.description,
          priority: spec.priority,
          order,
          completed: spec.completed ?? false,
          dueDate: due,
        },
      });

      if (spec.label && byName[spec.label]) {
        await tx.taskLabel.create({
          data: { taskId: task.id, labelId: byName[spec.label] },
        });
      }

      await tx.activity.create({
        data: {
          taskId: task.id,
          action: "created",
          detail: "",
          createdAt: new Date(Date.now() - 86400000 * 3),
        },
      });
    }

    const created = await tx.task.findMany({
      where: { list: { boardId }, title: { startsWith: SHOWCASE } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    const ids = created.map((t) => t.id);

    const feed: { action: string; detail: string }[] = [
      { action: "moved", detail: "In progress" },
      { action: "moved", detail: "Backlog" },
      { action: "comment", detail: "Synced with client — scope narrowed" },
      { action: "moved", detail: "Done" },
      { action: "comment", detail: "Linked to steering deck v3" },
      { action: "moved", detail: "In progress" },
      { action: "comment", detail: "Waiting on security sign-off" },
      { action: "archived", detail: "" },
      { action: "unarchived", detail: "" },
      { action: "moved", detail: "In progress" },
      { action: "comment", detail: "Added acceptance criteria" },
      { action: "moved", detail: "Done" },
      { action: "created", detail: "" },
    ];

    for (let i = 0; i < 48; i++) {
      const taskId = ids[i % ids.length];
      const row = feed[i % feed.length];
      await tx.activity.create({
        data: {
          taskId,
          action: row.action,
          detail: row.detail,
          createdAt: new Date(Date.now() - (i + 1) * 55 * 60000),
        },
      });
    }
  });
}

type NodeSeed = {
  id: string;
  x: number;
  y: number;
  title: string;
  description: string;
  tags: string[];
  status: string;
  priority: string;
};

const edge = (
  sessionId: string,
  sourceNum: number,
  targetNum: number,
  i: number,
) => {
  const nid = (n: number) => `${sessionId}-showcase-n${n}`;
  return {
    id: `${sessionId}-showcase-edge-${i}`,
    sourceId: nid(sourceNum),
    targetId: nid(targetNum),
  };
};

/**
 * Seeds demo nodes on the oldest session with an empty canvas. Used by dev showcase reset only — not
 * called when listing sessions for a workspace (new brands should start with a blank canvas).
 */
export async function ensureBrainstormShowcaseForProject(projectId: string) {
  const sessions = await prisma.brainstormSession.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  for (const s of sessions) {
    const count = await prisma.ideaNode.count({ where: { sessionId: s.id } });
    if (count === 0) {
      await ensureBrainstormShowcase(s.id);
      return;
    }
  }
}

export async function ensureBrainstormShowcase(sessionId: string) {
  const n = await prisma.ideaNode.count({ where: { sessionId } });
  if (n > 0) return;

  const nid = (n: number) => `${sessionId}-showcase-n${n}`;

  const nodes: NodeSeed[] = [
    {
      id: nid(1),
      x: 80,
      y: 60,
      title: `${SHOWCASE} North-star outcome`,
      description: "Measurable client success: cycle time −30%, audit-ready reporting, single owner per workstream.",
      tags: ["strategy", "exec"],
      status: "idea",
      priority: "high",
    },
    {
      id: nid(2),
      x: 420,
      y: 40,
      title: "Capability map",
      description: "People, process, data, and tech layers with maturity heat map.",
      tags: ["assessment"],
      status: "idea",
      priority: "medium",
    },
    {
      id: nid(3),
      x: 760,
      y: 100,
      title: "Risk & dependency web",
      description: "External vendors, regulatory gates, and contingency triggers.",
      tags: ["risk"],
      status: "idea",
      priority: "high",
    },
    {
      id: nid(4),
      x: 120,
      y: 320,
      title: "Pilot scope",
      description: "Two teams, six-week runway, success criteria tied to steering metrics.",
      tags: ["delivery"],
      status: "validated",
      priority: "medium",
    },
    {
      id: nid(5),
      x: 480,
      y: 300,
      title: "Change narrative",
      description: "Why now, what changes for me, and where to get help — by persona.",
      tags: ["comms"],
      status: "idea",
      priority: "low",
    },
    {
      id: nid(6),
      x: 820,
      y: 340,
      title: "Telemetry & KPIs",
      description: "Leading indicators in-product; lagging in weekly business review.",
      tags: ["metrics"],
      status: "idea",
      priority: "medium",
    },
    {
      id: nid(7),
      x: 260,
      y: 520,
      title: "Handover blueprint",
      description: "BAU roles, SLAs, escalation tree, and quarterly review cadence.",
      tags: ["sustain"],
      status: "idea",
      priority: "low",
    },
    {
      id: nid(8),
      x: 620,
      y: 540,
      title: "Option A vs B",
      description: "Build vs buy summary with TCO bands and decision deadline.",
      tags: ["decision"],
      status: "validated",
      priority: "high",
    },
    {
      id: nid(9),
      x: 960,
      y: 480,
      title: "Next experiments",
      description: "Queue of three testable bets with owners and kill criteria.",
      tags: ["innovation"],
      status: "idea",
      priority: "medium",
    },
    {
      id: nid(10),
      x: 1040,
      y: 200,
      title: "Stakeholder heat map",
      description: "Influence vs interest; coalition plan for blockers.",
      tags: ["people"],
      status: "idea",
      priority: "medium",
    },
    {
      id: nid(11),
      x: 40,
      y: 200,
      title: "Constraints",
      description: "Budget cap, fixed go-live date, must-use identity provider.",
      tags: ["constraints"],
      status: "idea",
      priority: "high",
    },
    {
      id: nid(12),
      x: 600,
      y: 120,
      title: "Integration fabric",
      description: "Events, APIs, batch windows, and failure domains across systems.",
      tags: ["architecture"],
      status: "idea",
      priority: "medium",
    },
  ];

  const edges = [
    edge(sessionId, 1, 2, 1),
    edge(sessionId, 2, 3, 2),
    edge(sessionId, 1, 4, 3),
    edge(sessionId, 4, 5, 4),
    edge(sessionId, 5, 8, 5),
    edge(sessionId, 2, 12, 6),
    edge(sessionId, 12, 6, 7),
    edge(sessionId, 11, 1, 8),
    edge(sessionId, 10, 3, 9),
    edge(sessionId, 7, 4, 10),
    edge(sessionId, 6, 9, 11),
  ];

  await prisma.$transaction(async (tx) => {
    for (const node of nodes) {
      await tx.ideaNode.create({
        data: {
          id: node.id,
          sessionId,
          positionX: node.x,
          positionY: node.y,
          title: node.title,
          description: node.description,
          tags: node.tags,
          status: node.status,
          priority: node.priority,
        },
      });
    }
    for (const e of edges) {
      await tx.ideaEdge.create({
        data: {
          id: e.id,
          sessionId,
          sourceId: e.sourceId,
          targetId: e.targetId,
        },
      });
    }
  });
}
