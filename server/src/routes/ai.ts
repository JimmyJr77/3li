import { Router } from "express";
import { assertWorkspaceAccess } from "../lib/auth/workspaceScope.js";
import { prepareConsultingTurn } from "../lib/chat/prepareTurn.js";
import { prisma } from "../lib/db.js";
import {
  aiServiceUnavailableDetail,
  chatModel,
  getOpenAIOrNull,
  isAiBackendConfigured,
} from "../lib/openai/client.js";
import {
  runBrandRepCenterSession,
  runBrandRepReview,
  runMailroomCaptureDecomposition,
  runMailroomRouteSelectedItems,
  runMailroomRoutingPlan,
  runProjectManagerAgent,
} from "../lib/openai/surfaceAgents.js";
import { executeBrainstormCompletion } from "./aiBrainstormHandler.js";
import { AGENT_KIND_ADVISOR_AGENTS, AGENT_KIND_BRAINSTORM_AI } from "../lib/agentSessions/constants.js";
import { mailLogDetail } from "../lib/agentSessions/mailLogDetail.js";
import {
  logBrainstormAiTurn,
  logBrandRepTurn,
  logMailClerkTurn,
  logProjectManagerTurn,
} from "../lib/agentSessions/service.js";

const router = Router();

function readAgentSessionId(body: unknown): string | undefined {
  const b = body as { agentSessionId?: unknown };
  return typeof b.agentSessionId === "string" && b.agentSessionId.trim() ? b.agentSessionId.trim() : undefined;
}

router.post("/brainstorm", async (req, res) => {
  try {
    if (!isAiBackendConfigured()) {
      res.status(503).json({
        error: "AI service unavailable",
        detail: aiServiceUnavailableDetail(),
      });
      return;
    }
    const body = req.body as { workspaceId?: string | null };
    if (body.workspaceId && typeof body.workspaceId === "string") {
      const ok = await assertWorkspaceAccess(req.appUser!, body.workspaceId);
      if (!ok) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    const { result } = await executeBrainstormCompletion(req.body);
    const bb = req.body as {
      workspaceId?: string | null;
      hubAgentKind?: unknown;
      brainstormCanvasSessionId?: unknown;
      prompt?: unknown;
      mode?: unknown;
      agentRole?: unknown;
      agentId?: unknown;
    };
    const ws = typeof bb.workspaceId === "string" ? bb.workspaceId : null;
    const hk = bb.hubAgentKind === AGENT_KIND_BRAINSTORM_AI || bb.hubAgentKind === AGENT_KIND_ADVISOR_AGENTS ? bb.hubAgentKind : null;
    let agentSessionIdOut: string | undefined;
    if (ws && hk) {
      try {
        const prompt = typeof bb.prompt === "string" ? bb.prompt : "";
        const modeStr = typeof bb.mode === "string" ? bb.mode : String(bb.mode ?? "");
        const agentRole =
          typeof bb.agentRole === "string" ? bb.agentRole : typeof bb.agentId === "string" ? bb.agentId : undefined;
        const canvasSid =
          typeof bb.brainstormCanvasSessionId === "string" && bb.brainstormCanvasSessionId.trim() ?
            bb.brainstormCanvasSessionId.trim()
          : undefined;
        const logged = await logBrainstormAiTurn({
          workspaceId: ws,
          hubAgentKind: hk,
          agentSessionId: readAgentSessionId(req.body),
          prompt,
          result,
          mode: modeStr,
          agentRole,
          brainstormCanvasSessionId: canvasSid,
        });
        agentSessionIdOut = logged.agentSessionId;
      } catch (logErr) {
        console.error("[agentSessions] brainstorm log", logErr);
      }
    }
    res.json({
      result,
      ...(agentSessionIdOut ? { agentSessionId: agentSessionIdOut } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "PROMPT_REQUIRED") {
      res.status(400).json({ error: "prompt is required" });
      return;
    }
    if (msg === "BAD_MODE") {
      res.status(400).json({ error: "mode must be divergent | convergent | strategic | execution" });
      return;
    }
    if (msg === "BAD_AGENT_ROLE") {
      res.status(400).json({ error: "agentRole must be consultant | red_team" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "AI request failed" });
  }
});

/**
 * CONTEXT_BUNDLE-style entry: `agentId`, `surfaceType`, and surface payload.
 * Supports: brainstorm, task_popup / generic (PM Agent), brand_rep_review, brand_rep_center.
 */
router.post("/agent", async (req, res) => {
  try {
    if (!isAiBackendConfigured()) {
      res.status(503).json({
        error: "AI service unavailable",
        detail: aiServiceUnavailableDetail(),
      });
      return;
    }

    const body = req.body as {
      schemaVersion?: string;
      agentId?: string;
      surfaceType?: string;
      prompt?: string;
      message?: string;
      mode?: unknown;
      context?: { selectedNodeSummary?: string; canvasSummary?: string };
      workspaceId?: string | null;
      agentRole?: unknown;
      surfacePayload?: { contextText?: string };
    };

    if (body.workspaceId && typeof body.workspaceId === "string") {
      const ok = await assertWorkspaceAccess(req.appUser!, body.workspaceId);
      if (!ok) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    const surface = body.surfaceType ?? "brainstorm";

    if (surface === "task_popup" || surface === "generic") {
      const openai = getOpenAIOrNull();
      if (!openai) {
        res.status(503).json({
          error: "AI service unavailable",
          detail: aiServiceUnavailableDetail(),
        });
        return;
      }
      const message = (typeof body.message === "string" ? body.message : undefined) ??
        (typeof body.prompt === "string" ? body.prompt : undefined) ??
        "";
      try {
        const result = await runProjectManagerAgent(openai, {
          workspaceId: typeof body.workspaceId === "string" ? body.workspaceId : null,
          message,
          contextText: body.surfacePayload?.contextText,
        });
        const wsPm = typeof body.workspaceId === "string" ? body.workspaceId : null;
        let agentSessionIdPm: string | undefined;
        if (wsPm) {
          try {
            const ctx = body.surfacePayload?.contextText;
            const logged = await logProjectManagerTurn({
              workspaceId: wsPm,
              agentSessionId: readAgentSessionId(body),
              message,
              result,
              contextSnippet: typeof ctx === "string" ? ctx : null,
            });
            agentSessionIdPm = logged.agentSessionId;
          } catch (logErr) {
            console.error("[agentSessions] pm log", logErr);
          }
        }
        res.json({
          schemaVersion: body.schemaVersion ?? "1.0.0",
          agentId: body.agentId ?? "project_manager",
          surfaceType: surface,
          result,
          ...(agentSessionIdPm ? { agentSessionId: agentSessionIdPm } : {}),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "MESSAGE_REQUIRED") {
          res.status(400).json({ error: "message or prompt is required" });
          return;
        }
        throw e;
      }
      return;
    }

    if (surface === "brand_rep_review") {
      const openai = getOpenAIOrNull();
      if (!openai) {
        res.status(503).json({
          error: "AI service unavailable",
          detail: aiServiceUnavailableDetail(),
        });
        return;
      }
      const message = (typeof body.message === "string" ? body.message : undefined) ??
        (typeof body.prompt === "string" ? body.prompt : undefined) ??
        "";
      try {
        const result = await runBrandRepReview(openai, {
          workspaceId: typeof body.workspaceId === "string" ? body.workspaceId : null,
          message,
        });
        const wsBr = typeof body.workspaceId === "string" ? body.workspaceId : null;
        let agentSessionIdBr: string | undefined;
        if (wsBr) {
          try {
            const logged = await logBrandRepTurn({
              workspaceId: wsBr,
              agentSessionId: readAgentSessionId(body),
              surfaceType: "brand_rep_review",
              userMessage: message,
              assistantText: result,
            });
            agentSessionIdBr = logged.agentSessionId;
          } catch (logErr) {
            console.error("[agentSessions] brand rep review log", logErr);
          }
        }
        res.json({
          schemaVersion: body.schemaVersion ?? "1.0.0",
          agentId: "brand_rep",
          surfaceType: surface,
          result,
          ...(agentSessionIdBr ? { agentSessionId: agentSessionIdBr } : {}),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "MESSAGE_REQUIRED") {
          res.status(400).json({ error: "message or prompt is required" });
          return;
        }
        if (msg === "BRAND_KIT_REQUIRED") {
          res.status(400).json({ error: "Brand kit required — complete Brand Center for this workspace" });
          return;
        }
        throw e;
      }
      return;
    }

    if (surface === "brand_rep_center") {
      const openai = getOpenAIOrNull();
      if (!openai) {
        res.status(503).json({
          error: "AI service unavailable",
          detail: aiServiceUnavailableDetail(),
        });
        return;
      }
      const bodyExt = req.body as {
        message?: string;
        surfacePayload?: {
          mode?: string;
          consultSectionId?: string;
          transcript?: string;
          brandProfileDraft?: unknown;
          consultFieldId?: string;
          consultFieldLabel?: string;
          consultFieldSnippet?: string;
          consultFieldFilled?: boolean;
          consultScratchLog?: unknown;
        };
      };
      const message =
        (typeof bodyExt.message === "string" ? bodyExt.message : undefined) ??
        (typeof body.prompt === "string" ? body.prompt : undefined) ??
        "";
      const sp = bodyExt.surfacePayload ?? {};
      const mode = sp.mode === "consult" ? "consult" : "ask";
      const consultSectionId = typeof sp.consultSectionId === "string" ? sp.consultSectionId : "discovery";
      const transcript = typeof sp.transcript === "string" ? sp.transcript : "";
      const ws = typeof body.workspaceId === "string" ? body.workspaceId : "";
      try {
        const scratchRaw = sp.consultScratchLog;
        const consultScratchLog = Array.isArray(scratchRaw)
          ? scratchRaw
              .map((row) => {
                if (!row || typeof row !== "object") return null;
                const r = row as Record<string, unknown>;
                const fieldId = typeof r.fieldId === "string" ? r.fieldId.trim() : "";
                const fieldLabel = typeof r.fieldLabel === "string" ? r.fieldLabel.trim() : "";
                const note = typeof r.note === "string" ? r.note.trim() : "";
                if (!fieldId) return null;
                return { fieldId, fieldLabel, note };
              })
              .filter((x): x is { fieldId: string; fieldLabel: string; note: string } => x !== null)
          : [];

        const turn = await runBrandRepCenterSession(openai, {
          workspaceId: ws,
          mode,
          consultSectionId,
          userMessage: message,
          transcript,
          brandProfileDraft: sp.brandProfileDraft,
          consultFieldId: typeof sp.consultFieldId === "string" ? sp.consultFieldId : null,
          consultFieldLabel: typeof sp.consultFieldLabel === "string" ? sp.consultFieldLabel : null,
          consultFieldSnippet: typeof sp.consultFieldSnippet === "string" ? sp.consultFieldSnippet : null,
          consultFieldFilled: typeof sp.consultFieldFilled === "boolean" ? sp.consultFieldFilled : null,
          consultScratchLog,
        });
        let agentSessionIdBc: string | undefined;
        if (ws) {
          try {
            const logged = await logBrandRepTurn({
              workspaceId: ws,
              agentSessionId: readAgentSessionId(body),
              surfaceType: "brand_rep_center",
              userMessage: message,
              assistantText: turn.assistantMessage,
              extras: {
                consultSectionId,
                mode,
                consultFieldId: typeof sp.consultFieldId === "string" ? sp.consultFieldId : null,
              },
            });
            agentSessionIdBc = logged.agentSessionId;
          } catch (logErr) {
            console.error("[agentSessions] brand rep center log", logErr);
          }
        }
        res.json({
          schemaVersion: body.schemaVersion ?? "1.0.0",
          agentId: "brand_rep",
          surfaceType: surface,
          result: turn.assistantMessage,
          brandRepCenter: turn,
          ...(agentSessionIdBc ? { agentSessionId: agentSessionIdBc } : {}),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "WORKSPACE_REQUIRED") {
          res.status(400).json({ error: "workspaceId is required" });
          return;
        }
        throw e;
      }
      return;
    }

    if (surface === "mail_clerk_decompose") {
      const openai = getOpenAIOrNull();
      if (!openai) {
        res.status(503).json({
          error: "AI service unavailable",
          detail: aiServiceUnavailableDetail(),
        });
        return;
      }
      const bodyExt = req.body as {
        capture?: string;
        instruction?: string;
        surfacePayload?: { capture?: string; instruction?: string };
      };
      const capture =
        (typeof bodyExt.capture === "string" ? bodyExt.capture : undefined) ??
        (typeof bodyExt.surfacePayload?.capture === "string" ? bodyExt.surfacePayload.capture : undefined) ??
        "";
      const instruction =
        (typeof bodyExt.instruction === "string" ? bodyExt.instruction : undefined) ??
        (typeof bodyExt.surfacePayload?.instruction === "string" ? bodyExt.surfacePayload.instruction : undefined) ??
        "";
      try {
        const decomposition = await runMailroomCaptureDecomposition(openai, {
          workspaceId: typeof body.workspaceId === "string" ? body.workspaceId : null,
          capture,
          instruction,
        });
        const wsMail = typeof body.workspaceId === "string" ? body.workspaceId : null;
        let agentSessionIdMail: string | undefined;
        if (wsMail) {
          try {
            const logged = await logMailClerkTurn({
              workspaceId: wsMail,
              agentSessionId: readAgentSessionId(body),
              surfaceType: "mail_clerk_decompose",
              titleHint: capture || decomposition.executiveSummary,
              summary: decomposition.executiveSummary,
              payload: mailLogDetail("mail_clerk_decompose", decomposition, undefined),
            });
            agentSessionIdMail = logged.agentSessionId;
          } catch (logErr) {
            console.error("[agentSessions] mail decompose log", logErr);
          }
        }
        res.json({
          schemaVersion: body.schemaVersion ?? "1.0.0",
          agentId: "mail_clerk",
          surfaceType: surface,
          result: decomposition.executiveSummary,
          decomposition,
          ...(agentSessionIdMail ? { agentSessionId: agentSessionIdMail } : {}),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "CAPTURE_REQUIRED") {
          res.status(400).json({ error: "capture is required (body.capture or surfacePayload.capture)" });
          return;
        }
        if (msg === "WORKSPACE_REQUIRED") {
          res.status(400).json({ error: "workspaceId is required" });
          return;
        }
        throw e;
      }
      return;
    }

    if (surface === "mail_clerk_route") {
      const openai = getOpenAIOrNull();
      if (!openai) {
        res.status(503).json({
          error: "AI service unavailable",
          detail: aiServiceUnavailableDetail(),
        });
        return;
      }
      const bodyExt = req.body as {
        instruction?: string;
        capture?: string;
        surfacePayload?: {
          actionItems?: unknown;
          instruction?: string;
          originalCapture?: string;
        };
      };
      const instruction =
        (typeof bodyExt.instruction === "string" ? bodyExt.instruction : undefined) ??
        (typeof bodyExt.surfacePayload?.instruction === "string" ? bodyExt.surfacePayload.instruction : undefined) ??
        "";
      const originalCapture =
        (typeof bodyExt.capture === "string" ? bodyExt.capture : undefined) ??
        (typeof bodyExt.surfacePayload?.originalCapture === "string"
          ? bodyExt.surfacePayload.originalCapture
          : undefined) ??
        "";
      const rawItems = bodyExt.surfacePayload?.actionItems;
      const actionItems: { summary: string; detail: string }[] = [];
      if (Array.isArray(rawItems)) {
        for (const it of rawItems) {
          if (!it || typeof it !== "object") continue;
          const r = it as Record<string, unknown>;
          const summary = typeof r.summary === "string" ? r.summary.trim() : "";
          const detail = typeof r.detail === "string" ? r.detail.trim() : "";
          if (!summary && !detail) continue;
          actionItems.push({
            summary: summary.slice(0, 500),
            detail: detail.slice(0, 8000),
          });
        }
      }
      try {
        const plan = await runMailroomRouteSelectedItems(openai, {
          workspaceId: typeof body.workspaceId === "string" ? body.workspaceId : null,
          actionItems,
          instruction,
          originalCapture,
        });
        const wsRoute = typeof body.workspaceId === "string" ? body.workspaceId : null;
        let agentSessionIdRoute: string | undefined;
        if (wsRoute) {
          try {
            const logged = await logMailClerkTurn({
              workspaceId: wsRoute,
              agentSessionId: readAgentSessionId(body),
              surfaceType: "mail_clerk_route",
              titleHint: originalCapture || plan.executiveSummary,
              summary: plan.executiveSummary,
              payload: mailLogDetail("mail_clerk_route", undefined, plan),
            });
            agentSessionIdRoute = logged.agentSessionId;
          } catch (logErr) {
            console.error("[agentSessions] mail route log", logErr);
          }
        }
        res.json({
          schemaVersion: body.schemaVersion ?? "1.0.0",
          agentId: "mail_clerk",
          surfaceType: surface,
          result: plan.executiveSummary,
          plan,
          ...(agentSessionIdRoute ? { agentSessionId: agentSessionIdRoute } : {}),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "ACTION_ITEMS_REQUIRED") {
          res.status(400).json({ error: "surfacePayload.actionItems must be a non-empty array" });
          return;
        }
        if (msg === "WORKSPACE_REQUIRED") {
          res.status(400).json({ error: "workspaceId is required" });
          return;
        }
        if (msg === "WORKSPACE_NOT_FOUND") {
          res.status(404).json({ error: "Workspace not found" });
          return;
        }
        throw e;
      }
      return;
    }

    if (surface === "mail_clerk_plan") {
      const openai = getOpenAIOrNull();
      if (!openai) {
        res.status(503).json({
          error: "AI service unavailable",
          detail: aiServiceUnavailableDetail(),
        });
        return;
      }
      const bodyExt = req.body as {
        capture?: string;
        instruction?: string;
        surfacePayload?: { capture?: string; instruction?: string };
      };
      const capture =
        (typeof bodyExt.capture === "string" ? bodyExt.capture : undefined) ??
        (typeof bodyExt.surfacePayload?.capture === "string" ? bodyExt.surfacePayload.capture : undefined) ??
        "";
      const instruction =
        (typeof bodyExt.instruction === "string" ? bodyExt.instruction : undefined) ??
        (typeof bodyExt.surfacePayload?.instruction === "string" ? bodyExt.surfacePayload.instruction : undefined) ??
        "";
      try {
        const plan = await runMailroomRoutingPlan(openai, {
          workspaceId: typeof body.workspaceId === "string" ? body.workspaceId : null,
          capture,
          instruction,
        });
        const wsPlan = typeof body.workspaceId === "string" ? body.workspaceId : null;
        let agentSessionIdPlan: string | undefined;
        if (wsPlan) {
          try {
            const logged = await logMailClerkTurn({
              workspaceId: wsPlan,
              agentSessionId: readAgentSessionId(body),
              surfaceType: "mail_clerk_plan",
              titleHint: capture || plan.executiveSummary,
              summary: plan.executiveSummary,
              payload: mailLogDetail("mail_clerk_plan", undefined, plan),
            });
            agentSessionIdPlan = logged.agentSessionId;
          } catch (logErr) {
            console.error("[agentSessions] mail plan log", logErr);
          }
        }
        res.json({
          schemaVersion: body.schemaVersion ?? "1.0.0",
          agentId: "mail_clerk",
          surfaceType: surface,
          result: plan.executiveSummary,
          plan,
          ...(agentSessionIdPlan ? { agentSessionId: agentSessionIdPlan } : {}),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "CAPTURE_REQUIRED") {
          res.status(400).json({ error: "capture is required (body.capture or surfacePayload.capture)" });
          return;
        }
        if (msg === "WORKSPACE_REQUIRED") {
          res.status(400).json({ error: "workspaceId is required" });
          return;
        }
        if (msg === "WORKSPACE_NOT_FOUND") {
          res.status(404).json({ error: "Workspace not found" });
          return;
        }
        throw e;
      }
      return;
    }

    if (surface !== "brainstorm") {
      res.status(400).json({
        error: "Unsupported surfaceType",
        detail:
          "Use brainstorm | task_popup | generic | brand_rep_review | brand_rep_center | mail_clerk_plan | mail_clerk_decompose | mail_clerk_route",
      });
      return;
    }

    const { result } = await executeBrainstormCompletion(body);
    const bb2 = body as {
      workspaceId?: string | null;
      hubAgentKind?: unknown;
      brainstormCanvasSessionId?: unknown;
      prompt?: unknown;
      mode?: unknown;
      agentRole?: unknown;
      agentId?: unknown;
    };
    const wsB2 = typeof bb2.workspaceId === "string" ? bb2.workspaceId : null;
    const hk2 =
      bb2.hubAgentKind === AGENT_KIND_BRAINSTORM_AI || bb2.hubAgentKind === AGENT_KIND_ADVISOR_AGENTS ?
        bb2.hubAgentKind
      : null;
    let agentSessionIdBs: string | undefined;
    if (wsB2 && hk2) {
      try {
        const promptStr = typeof bb2.prompt === "string" ? bb2.prompt : "";
        const modeStr2 = typeof bb2.mode === "string" ? bb2.mode : String(bb2.mode ?? "");
        const agentRole2 =
          typeof bb2.agentRole === "string" ? bb2.agentRole : typeof bb2.agentId === "string" ? bb2.agentId : undefined;
        const canvasSid2 =
          typeof bb2.brainstormCanvasSessionId === "string" && bb2.brainstormCanvasSessionId.trim() ?
            bb2.brainstormCanvasSessionId.trim()
          : undefined;
        const logged = await logBrainstormAiTurn({
          workspaceId: wsB2,
          hubAgentKind: hk2,
          agentSessionId: readAgentSessionId(body),
          prompt: promptStr,
          result,
          mode: modeStr2,
          agentRole: agentRole2,
          brainstormCanvasSessionId: canvasSid2,
        });
        agentSessionIdBs = logged.agentSessionId;
      } catch (logErr) {
        console.error("[agentSessions] agent/brainstorm log", logErr);
      }
    }
    res.json({
      schemaVersion: body.schemaVersion ?? "1.0.0",
      agentId: body.agentId ?? null,
      surfaceType: surface,
      result,
      ...(agentSessionIdBs ? { agentSessionId: agentSessionIdBs } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "PROMPT_REQUIRED") {
      res.status(400).json({ error: "prompt is required" });
      return;
    }
    if (msg === "BAD_MODE") {
      res.status(400).json({ error: "mode must be divergent | convergent | strategic | execution" });
      return;
    }
    if (msg === "BAD_AGENT_ROLE") {
      res.status(400).json({
        error: "Invalid agent for brainstorm",
        detail: "Use agentId ai_consultant, red_team, brand_rep, or consultant with brainstorm surface",
      });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "AI request failed" });
  }
});

router.post("/chat", async (req, res) => {
  try {
    const openai = getOpenAIOrNull();
    if (!openai) {
      res.status(503).json({
        error: "AI service unavailable",
        detail: aiServiceUnavailableDetail(),
      });
      return;
    }

    const body = req.body as {
      prompt?: string;
      message?: string;
      projectId?: string;
      threadId?: string | null;
      consultingMode?: unknown;
      workspaceId?: string | null;
    };
    const message = (typeof body.message === "string" ? body.message : undefined) ??
      (typeof body.prompt === "string" ? body.prompt : undefined);

    if (!message?.trim()) {
      res.status(400).json({ error: "prompt or message is required" });
      return;
    }

    const prep = await prepareConsultingTurn(req.appUser!, { ...body, message: message.trim() });
    const completion = await openai.chat.completions.create({
      model: chatModel("primary"),
      messages: prep.openaiMessages,
    });
    const full = completion.choices[0]?.message?.content ?? "";
    if (!full) {
      res.status(500).json({ error: "Empty AI response" });
      return;
    }

    await prisma.chatMessage.create({
      data: {
        threadId: prep.thread.id,
        role: "assistant",
        content: full,
        citations: prep.citationPayload.length ? prep.citationPayload : undefined,
      },
    });
    await prisma.chatThread.update({
      where: { id: prep.thread.id },
      data: { updatedAt: new Date() },
    });

    res.json({
      result: full,
      threadId: prep.thread.id,
      projectId: prep.projectId,
      consultingMode: prep.mode,
      citations: prep.citationPayload,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "THREAD_NOT_FOUND") {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    if (msg === "THREAD_PROJECT_MISMATCH") {
      res.status(400).json({ error: "thread project mismatch" });
      return;
    }
    if (msg === "message is required") {
      res.status(400).json({ error: "prompt or message is required" });
      return;
    }
    if (msg === "WORKSPACE_FORBIDDEN") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (msg === "MESSAGE_STATE_INVALID") {
      res.status(500).json({ error: "Message state invalid" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "AI request failed" });
  }
});

export default router;
