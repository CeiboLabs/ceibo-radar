import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isAiAvailable, callAI } from "@/lib/ai/aiService";
import { buildNichesPrompt, NICHES_SYSTEM_PROMPT } from "@/lib/ai/promptBuilders";
import { parseNichesResult } from "@/lib/ai/aiParsers";
import type { NicheStats } from "@/lib/ai/types";

// Cache TTL: 24 hours
const CACHE_KEY = "niches_analysis";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  const db = getDb();

  // Check cache
  const cached = db
    .prepare("SELECT value, created_at FROM ai_cache WHERE key = ?")
    .get(CACHE_KEY) as { value: string; created_at: string } | undefined;

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

  // Aggregate stats by category (min 2 leads to be meaningful)
  const stats = db.prepare(`
    SELECT
      category,
      COUNT(*) as total,
      SUM(CASE WHEN has_website = 0 THEN 1 ELSE 0 END) as no_website,
      SUM(CASE WHEN website_quality = 'poor' THEN 1 ELSE 0 END) as poor_website,
      ROUND(AVG(COALESCE(lead_score, 0))) as avg_score
    FROM leads
    WHERE category IS NOT NULL AND category != ''
    GROUP BY category
    HAVING COUNT(*) >= 2
    ORDER BY no_website DESC, total DESC
    LIMIT 30
  `).all() as NicheStats[];

  if (stats.length === 0) {
    return NextResponse.json(
      { error: "No hay suficientes leads con categoría para analizar nichos." },
      { status: 400 }
    );
  }

  try {
    const userPrompt = buildNichesPrompt(stats);
    const raw = await callAI(NICHES_SYSTEM_PROMPT, userPrompt, 1000);
    const result = parseNichesResult(raw);

    // Save to cache (upsert)
    db.prepare(`
      INSERT INTO ai_cache (key, value, created_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, created_at = excluded.created_at
    `).run(CACHE_KEY, JSON.stringify(result));

    return NextResponse.json({ ...result, cached: false });
  } catch (err) {
    console.error("[AI Niches] Error:", err);
    return NextResponse.json({ error: "El análisis de nichos falló. Intenta de nuevo." }, { status: 500 });
  }
}

// Force refresh (ignores cache)
export async function POST() {
  const db = getDb();
  db.prepare("DELETE FROM ai_cache WHERE key = ?").run(CACHE_KEY);

  return GET();
}
