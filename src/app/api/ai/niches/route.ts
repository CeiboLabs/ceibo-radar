import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAiAvailable, callAI } from "@/lib/ai/aiService";
import { buildNichesPrompt, NICHES_SYSTEM_PROMPT } from "@/lib/ai/promptBuilders";
import { parseNichesResult } from "@/lib/ai/aiParsers";
import type { NicheStats } from "@/lib/ai/types";

const CACHE_KEY = "niches_analysis";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  // Check cache
  const { data: cached } = await supabase
    .from("ai_cache")
    .select("value, created_at")
    .eq("key", CACHE_KEY)
    .single();

  if (cached) {
    const age = Date.now() - new Date(cached.created_at).getTime();
    if (age < CACHE_TTL_MS) {
      return NextResponse.json({ ...JSON.parse(cached.value), cached: true });
    }
  }

  if (!isAiAvailable()) {
    return NextResponse.json(
      { error: "AI no disponible. Configura OPENAI_API_KEY en .env.local." },
      { status: 503 }
    );
  }

  // Aggregate by category in JS
  const { data: leadsData } = await supabase
    .from("leads")
    .select("category, has_website, website_quality, lead_score")
    .not("category", "is", null)
    .neq("category", "");

  const catMap = new Map<string, { total: number; no_website: number; poor_website: number; score_sum: number; score_count: number }>();
  for (const l of leadsData ?? []) {
    if (!l.category) continue;
    if (!catMap.has(l.category)) catMap.set(l.category, { total: 0, no_website: 0, poor_website: 0, score_sum: 0, score_count: 0 });
    const e = catMap.get(l.category)!;
    e.total++;
    if (!l.has_website) e.no_website++;
    if (l.website_quality === "poor") e.poor_website++;
    if (l.lead_score != null) { e.score_sum += l.lead_score; e.score_count++; }
  }

  const stats: NicheStats[] = Array.from(catMap.entries())
    .filter(([, e]) => e.total >= 2)
    .map(([category, e]) => ({
      category,
      total: e.total,
      no_website: e.no_website,
      poor_website: e.poor_website,
      avg_score: e.score_count > 0 ? Math.round(e.score_sum / e.score_count) : 0,
    }))
    .sort((a, b) => b.no_website - a.no_website || b.total - a.total)
    .slice(0, 30);

  if (stats.length === 0) {
    return NextResponse.json(
      { error: "No hay suficientes leads con categoría para analizar nichos." },
      { status: 400 }
    );
  }

  try {
    const raw = await callAI(NICHES_SYSTEM_PROMPT, buildNichesPrompt(stats), 1000);
    const result = parseNichesResult(raw);

    // Upsert cache
    await supabase.from("ai_cache").upsert(
      { key: CACHE_KEY, value: JSON.stringify(result), created_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    return NextResponse.json({ ...result, cached: false });
  } catch (err) {
    console.error("[AI Niches] Error:", err);
    return NextResponse.json({ error: "El análisis de nichos falló. Intenta de nuevo." }, { status: 500 });
  }
}

export async function POST() {
  await supabase.from("ai_cache").delete().eq("key", CACHE_KEY);
  return GET();
}
