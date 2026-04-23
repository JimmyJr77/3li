import { aiServiceUnavailableDetail, getOpenAIOrNull } from "./client.js";
import { chatModel } from "../ai/models.js";
import {
  buildBrainstormUserPrompt,
  overlayForBrainstormAgentRole,
  systemPromptForMode,
  type BrainstormAgentRole,
} from "./brainstormPrompts.js";
import { formatBrainstormContextAddonForBrainstorm } from "../contextInstructions.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import type { ThinkingMode } from "./thinkingMode.js";

export async function runAI(prompt: string): Promise<string> {
  const openai = getOpenAIOrNull();
  if (!openai) {
    throw new Error(aiServiceUnavailableDetail());
  }

  const response = await openai.chat.completions.create({
    model: chatModel("primary"),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty AI response");
  }
  return content;
}

export async function runBrainstormAI(
  mode: ThinkingMode,
  userPrompt: string,
  context?: { selectedNodeSummary?: string; canvasSummary?: string },
  brandContextBlock = "",
  agentRole: BrainstormAgentRole = "consultant",
  options?: {
    workspaceId?: string | null;
    /** Appended last (e.g. Brand Rep overlay). */
    personaAddon?: string;
  },
): Promise<string> {
  const openai = getOpenAIOrNull();
  if (!openai) {
    throw new Error(aiServiceUnavailableDetail());
  }

  const roleOverlay = overlayForBrainstormAgentRole(agentRole);
  const systemBase = `${systemPromptForMode(mode)}\n\n---\n${roleOverlay}`;
  const ctxBlock = await formatBrainstormContextAddonForBrainstorm(options?.workspaceId);
  let system = systemBase;
  if (ctxBlock.trim()) {
    system = `${system}\n\n---\n\n${ctxBlock.trim()}`;
  }
  if (brandContextBlock.trim()) {
    system = `${system}\n\n---\n\n${brandContextBlock.trim()}`;
  }
  const addon = options?.personaAddon?.trim();
  if (addon) {
    system = `${system}\n\n---\n\n${addon}`;
  }

  const response = await openai.chat.completions.create({
    model: chatModel("primary"),
    messages: [
      { role: "system", content: system },
      { role: "user", content: buildBrainstormUserPrompt(userPrompt, context) },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty AI response");
  }
  return content;
}

export async function runBrainstormWithSystem(system: string, userPrompt: string): Promise<string> {
  const openai = getOpenAIOrNull();
  if (!openai) {
    throw new Error(aiServiceUnavailableDetail());
  }

  const response = await openai.chat.completions.create({
    model: chatModel("primary"),
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty AI response");
  }
  return content;
}
