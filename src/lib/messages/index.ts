import type { Lead } from "@/lib/types";
import { buildLeadContext } from "./types";
import type { GeneratedMessages } from "./types";

export type { GeneratedMessages } from "./types";

/**
 * Main entry point. Detects which generator to use based on env config.
 * Falls back to templates automatically — no errors thrown to the caller.
 */
export async function generateMessages(lead: Lead): Promise<GeneratedMessages> {
  const ctx = buildLeadContext(lead);

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { generateWithAI } = await import("./ai-generator");
      return await generateWithAI(ctx);
    } catch (err) {
      console.error("[Messages] AI generation failed, using templates:", err);
      // Fall through to template fallback
    }
  }

  const { generateWithTemplates } = await import("./template-generator");
  return generateWithTemplates(ctx);
}
