import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAiAvailable, callAI } from "@/lib/ai/aiService";
import { buildLeadPrompt, LEAD_SYSTEM_PROMPT } from "@/lib/ai/promptBuilders";
import { parseLeadResult } from "@/lib/ai/aiParsers";
import { logEvent } from "@/lib/lead-events";
import type { Lead } from "@/lib/types";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: lead, error } = await supabase.from("leads").select("*").eq("id", id).single();
  if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const typedLead = lead as unknown as Lead;

  if (typedLead.ai_analyzed_at && typedLead.ai_summary) {
    const age = Date.now() - new Date(typedLead.ai_analyzed_at).getTime();
    if (age < CACHE_TTL_MS) {
      return NextResponse.json({
        summary: typedLead.ai_summary,
        analysis: typedLead.ai_analysis ? JSON.parse(typedLead.ai_analysis) : null,
        premium_tier: typedLead.ai_premium_tier,
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
    const raw = await callAI(LEAD_SYSTEM_PROMPT, buildLeadPrompt(typedLead));
    const result = parseLeadResult(raw);

    await supabase.from("leads").update({
      ai_summary: result.summary,
      ai_analysis: JSON.stringify(result.analysis),
      ai_premium_tier: result.premium_tier,
      ai_analyzed_at: new Date().toISOString(),
    }).eq("id", id);

    logEvent(Number(id), "ai_analyzed", "Análisis AI generado ✦");

    return NextResponse.json({ ...result, cached: false });
  } catch (err) {
    console.error("[AI Analyze] Error:", err);
    return NextResponse.json({ error: "El análisis AI falló. Intenta de nuevo." }, { status: 500 });
  }
}
