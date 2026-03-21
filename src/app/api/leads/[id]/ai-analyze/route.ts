import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isAiAvailable, callAI } from "@/lib/ai/aiService";
import { buildLeadPrompt, LEAD_SYSTEM_PROMPT } from "@/lib/ai/promptBuilders";
import { parseLeadResult } from "@/lib/ai/aiParsers";
import { logEvent } from "@/lib/lead-events";
import type { Lead } from "@/lib/types";

// Cache TTL: 7 days
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(Number(id)) as Lead | undefined;
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Return cached result if fresh
  if (lead.ai_analyzed_at && lead.ai_summary) {
    const age = Date.now() - new Date(lead.ai_analyzed_at).getTime();
    if (age < CACHE_TTL_MS) {
      return NextResponse.json({
        summary: lead.ai_summary,
        analysis: lead.ai_analysis ? JSON.parse(lead.ai_analysis) : null,
        premium_tier: lead.ai_premium_tier,
        cached: true,
      });
    }
  }

  if (!isAiAvailable()) {
    return NextResponse.json(
      { error: "AI no disponible. Configura OPENAI_API_KEY en .env.local." },
      { status: 503 }
    );
  }

  try {
    const userPrompt = buildLeadPrompt(lead);
    const raw = await callAI(LEAD_SYSTEM_PROMPT, userPrompt);
    const result = parseLeadResult(raw);

    db.prepare(`
      UPDATE leads SET
        ai_summary = ?,
        ai_analysis = ?,
        ai_premium_tier = ?,
        ai_analyzed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      result.summary,
      JSON.stringify(result.analysis),
      result.premium_tier,
      Number(id)
    );

    logEvent(Number(id), "ai_analyzed", "Análisis AI generado ✦");

    return NextResponse.json({ ...result, cached: false });
  } catch (err) {
    console.error("[AI Analyze] Error:", err);
    return NextResponse.json({ error: "El análisis AI falló. Intenta de nuevo." }, { status: 500 });
  }
}
