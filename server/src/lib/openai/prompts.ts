export const SYSTEM_PROMPT = `
You are a high-level consulting assistant.
You structure ideas, create plans, and generate actionable outputs.
`;

export const brainstormPrompt = (input: string) => `
Expand this idea into structured, high-quality concepts:

${input}
`;

export const taskPrompt = (input: string) => `
Turn this into a prioritized task list:

${input}
`;
