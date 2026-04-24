import { api } from "@/lib/api/client";

export type MailroomPlanChunk = {
  summary: string;
  suggestedDestination: "notes" | "boards" | "brainstorm" | "brand_center" | "hold" | "other";
  targetHint: string;
  rationale: string;
  confidence: number;
};

export type MailroomPlanPayload = {
  executiveSummary: string;
  chunks: MailroomPlanChunk[];
};

/** Step 1 — routable pieces only (no destinations). Mirrors server shape. */
export type MailroomActionItemDecomp = {
  summary: string;
  detail: string;
};

export type MailroomDecompositionPayload = {
  executiveSummary: string;
  actionItems: MailroomActionItemDecomp[];
};

export type ConsultScratchLogEntry = {
  fieldId: string;
  fieldLabel: string;
  note: string;
};

export type BrandRepCenterPayload = {
  assistantMessage: string;
  proposedProfilePatch: Record<string, unknown> | null;
  /** Legacy; field walk uses Submit in the kit pane instead. */
  consultAwaitingVerdict?: boolean;
};

export type AgentSurfaceResponse = {
  schemaVersion?: string;
  agentId?: string | null;
  surfaceType?: string;
  result: string;
  plan?: MailroomPlanPayload;
  decomposition?: MailroomDecompositionPayload;
  brandRepCenter?: BrandRepCenterPayload;
  /** Returned when the server logs this turn to an agent session. */
  agentSessionId?: string;
};

export async function postAgentSurface(body: {
  schemaVersion?: string;
  agentId?: string;
  surfaceType: string;
  workspaceId?: string | null;
  message?: string;
  capture?: string;
  instruction?: string;
  surfacePayload?: Record<string, unknown>;
  agentSessionId?: string | null;
  hubAgentKind?: string;
  brainstormCanvasSessionId?: string | null;
}): Promise<AgentSurfaceResponse> {
  const { data } = await api.post<AgentSurfaceResponse>("/api/ai/agent", body);
  return data;
}

export async function postProjectManagerAgent(body: {
  workspaceId: string;
  message: string;
  contextText?: string;
  agentSessionId?: string | null;
}): Promise<AgentSurfaceResponse> {
  return postAgentSurface({
    schemaVersion: "1.0.0",
    agentId: "project_manager",
    surfaceType: "task_popup",
    workspaceId: body.workspaceId,
    message: body.message,
    surfacePayload: body.contextText ? { contextText: body.contextText } : undefined,
    agentSessionId: body.agentSessionId,
  });
}

export async function postBrandRepReview(body: {
  workspaceId: string;
  message: string;
  agentSessionId?: string | null;
}): Promise<AgentSurfaceResponse> {
  return postAgentSurface({
    schemaVersion: "1.0.0",
    agentId: "brand_rep",
    surfaceType: "brand_rep_review",
    workspaceId: body.workspaceId,
    message: body.message,
    agentSessionId: body.agentSessionId,
  });
}

export async function postBrandRepCenter(body: {
  workspaceId: string;
  message: string;
  mode: "ask" | "consult";
  consultSectionId: string;
  transcript: string;
  brandProfileDraft: unknown;
  consultFieldId?: string;
  consultFieldLabel?: string;
  consultFieldSnippet?: string;
  consultFieldFilled?: boolean;
  /** Per-field scratch notes from earlier steps; used when compiling `otherBrandConsiderations`. */
  consultScratchLog?: ConsultScratchLogEntry[];
  agentSessionId?: string | null;
}): Promise<AgentSurfaceResponse & { brandRepCenter: BrandRepCenterPayload }> {
  const { data } = await api.post<AgentSurfaceResponse & { brandRepCenter: BrandRepCenterPayload }>(
    "/api/ai/agent",
    {
      schemaVersion: "1.0.0",
      agentId: "brand_rep",
      surfaceType: "brand_rep_center",
      workspaceId: body.workspaceId,
      message: body.message,
      agentSessionId: body.agentSessionId,
      surfacePayload: {
        mode: body.mode,
        consultSectionId: body.consultSectionId,
        transcript: body.transcript,
        brandProfileDraft: body.brandProfileDraft,
        ...(body.consultFieldId
          ? {
              consultFieldId: body.consultFieldId,
              consultFieldLabel: body.consultFieldLabel,
              consultFieldSnippet: body.consultFieldSnippet,
              consultFieldFilled: body.consultFieldFilled,
            }
          : {}),
        ...(body.consultScratchLog && body.consultScratchLog.length > 0
          ? { consultScratchLog: body.consultScratchLog }
          : {}),
      },
    },
  );
  return data;
}

export async function postMailroomRoutingPlan(body: {
  workspaceId: string;
  capture: string;
  instruction?: string;
  agentSessionId?: string | null;
}): Promise<AgentSurfaceResponse & { plan: MailroomPlanPayload }> {
  const { data } = await api.post<AgentSurfaceResponse & { plan: MailroomPlanPayload }>(
    "/api/ai/agent",
    {
      schemaVersion: "1.0.0",
      agentId: "mail_clerk",
      surfaceType: "mail_clerk_plan",
      workspaceId: body.workspaceId,
      capture: body.capture,
      instruction: body.instruction,
      agentSessionId: body.agentSessionId,
    },
  );
  return data;
}

/** Mail Clerk step 1: exhaustive list of routable actions from capture (no routing). */
export async function postMailroomDecomposition(body: {
  workspaceId: string;
  capture: string;
  instruction?: string;
  agentSessionId?: string | null;
}): Promise<AgentSurfaceResponse & { decomposition: MailroomDecompositionPayload }> {
  const { data } = await api.post<AgentSurfaceResponse & { decomposition: MailroomDecompositionPayload }>(
    "/api/ai/agent",
    {
      schemaVersion: "1.0.0",
      agentId: "mail_clerk",
      surfaceType: "mail_clerk_decompose",
      workspaceId: body.workspaceId,
      capture: body.capture,
      instruction: body.instruction,
      agentSessionId: body.agentSessionId,
    },
  );
  return data;
}

/** Mail Clerk step 2: assign destinations for the given actions (same order). */
export async function postMailroomRouteFromActions(body: {
  workspaceId: string;
  actionItems: MailroomActionItemDecomp[];
  instruction?: string;
  originalCapture?: string;
  agentSessionId?: string | null;
}): Promise<AgentSurfaceResponse & { plan: MailroomPlanPayload }> {
  const { data } = await api.post<AgentSurfaceResponse & { plan: MailroomPlanPayload }>(
    "/api/ai/agent",
    {
      schemaVersion: "1.0.0",
      agentId: "mail_clerk",
      surfaceType: "mail_clerk_route",
      workspaceId: body.workspaceId,
      instruction: body.instruction,
      agentSessionId: body.agentSessionId,
      surfacePayload: {
        actionItems: body.actionItems,
        originalCapture: body.originalCapture,
        instruction: body.instruction,
      },
    },
  );
  return data;
}
