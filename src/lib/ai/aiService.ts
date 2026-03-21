import OpenAI from "openai";

let client: OpenAI | null = null;

export function isAiAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/**
 * Calls OpenAI gpt-4o-mini with the given prompts.
 * Forces JSON output via response_format.
 * Throws if AI is unavailable or call fails.
 */
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 900
): Promise<string> {
  if (!isAiAvailable()) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const openai = getClient();

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
