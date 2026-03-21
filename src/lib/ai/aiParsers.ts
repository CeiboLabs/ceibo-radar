import type { AiLeadResult, AiNichesResult } from "./types";

function stripFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export function parseLeadResult(raw: string): AiLeadResult {
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned);

  const analysis = parsed.analysis ?? {};
  return {
    summary: String(parsed.summary ?? ""),
    analysis: {
      digital_weaknesses: Array.isArray(analysis.digital_weaknesses)
        ? analysis.digital_weaknesses.map(String)
        : [],
      business_opportunities: Array.isArray(analysis.business_opportunities)
        ? analysis.business_opportunities.map(String)
        : [],
      digital_maturity_assessment: String(analysis.digital_maturity_assessment ?? ""),
      missing_conversion_channels: Array.isArray(analysis.missing_conversion_channels)
        ? analysis.missing_conversion_channels.map(String)
        : [],
    },
    premium_tier: (["$", "$$", "$$$"].includes(parsed.premium_tier)
      ? parsed.premium_tier
      : "$") as "$" | "$$" | "$$$",
  };
}

export function parseNichesResult(raw: string): AiNichesResult {
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned);

  return {
    niches: Array.isArray(parsed.niches)
      ? parsed.niches.map((n: Record<string, unknown>) => ({
          category: String(n.category ?? ""),
          rank: Number(n.rank ?? 0),
          opportunity_level: (["high", "medium", "low"].includes(n.opportunity_level as string)
            ? n.opportunity_level
            : "medium") as "high" | "medium" | "low",
          explanation: String(n.explanation ?? ""),
        }))
      : [],
    analyzed_at: new Date().toISOString(),
  };
}
