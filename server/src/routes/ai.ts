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

const router = Router();

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
    res.json({ result });
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
        res.json({
          schemaVersion: body.schemaVersion ?? "1.0.0",
          agentId: body.agentId ?? "project_manager",
          surfaceType: surface,
          result,
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
        res.json({
          schemaVersion: body.schemaVersion ?? "1.0.0",
          agentId: "brand_rep",
          surfaceType: surface,
          result,
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
        const turn = await runBrandRepCenterSession(openai, {
          workspaceId: ws,
          mode,
          consultSectionId,
          userMessage: message,
          transcript,
          brandProfileDraft: sp.brandProfileDraft,
        });
        res.json({
          schemaVersion: body.schemaVersion ?? "1.0.0",
          agentId: "brand_rep",
          surfaceType: surface,
          result: turn.assistantMessage,
          brandRepCenter: turn,
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
        res.json({
          schemaVersion: body.schemaVersion ?? "1.0.0",
          agentId: "mail_clerk",
          surfaceType: surface,
          result: decomposition.executiveSummary,
          decomposition,
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
        res.json({
          schemaVersion: body.schemaVersion ?? "1.0.0",
          agentId: "mail_clerk",
          surfaceType: surface,
          result: plan.executiveSummary,
          plan,
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
        res.json({
          schemaVersion: body.schemaVersion ?? "1.0.0",
          agentId: "mail_clerk",
          surfaceType: surface,
          result: plan.executiveSummary,
          plan,
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
    res.json({
      schemaVersion: body.schemaVersion ?? "1.0.0",
      agentId: body.agentId ?? null,
      surfaceType: surface,
      result,
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
