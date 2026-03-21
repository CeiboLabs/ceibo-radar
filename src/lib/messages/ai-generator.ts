import Anthropic from "@anthropic-ai/sdk";
import type { GeneratedMessages, LeadContext } from "./types";
import { buildPrompt, SYSTEM_PROMPT } from "./prompt";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }
  return client;
}

export async function generateWithAI(
  ctx: LeadContext
): Promise<GeneratedMessages> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildPrompt(ctx),
      },
    ],
  });

  const raw =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Strip markdown code fences if model wrapped the JSON
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  return {
    instagram: parsed.instagram,
    whatsapp: parsed.whatsapp,
    email: {
      subject: parsed.email.subject,
      body: parsed.email.body,
    },
    mode: "ai",
  };
}
