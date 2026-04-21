import { getOpenAIOrNull } from "./client.js";
import { buildBrainstormUserPrompt, systemPromptForMode } from "./brainstormPrompts.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import type { ThinkingMode } from "./thinkingMode.js";

export async function runAI(prompt: string): Promise<string> {
  const openai = getOpenAIOrNull();
  if (!openai) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
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
): Promise<string> {
  const openai = getOpenAIOrNull();
  if (!openai) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: systemPromptForMode(mode) },
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
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
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
