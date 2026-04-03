import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

export function isAiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Calls AI with the given prompts, returning raw JSON string.
 * Prefers Anthropic if ANTHROPIC_API_KEY is set, falls back to OpenAI.
 */
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 400
): Promise<string> {
  if (!isAiAvailable()) {
    throw new Error("No AI service configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY)");
  }

  // Anthropic path
  if (process.env.ANTHROPIC_API_KEY) {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system: systemPrompt + "\n\nSiempre responde con JSON válido, sin markdown, sin texto extra.",
      messages: [{ role: "user", content: userPrompt }],
    });
    const raw = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    return raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  }

  // OpenAI fallback
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  return response.choices[0]?.message?.content ?? "{}";
}
