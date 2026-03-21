import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/opportunities
 * Returns curated opportunity data for the Top Opportunities dashboard.
 */
export async function GET() {
  const db = getDb();

  // ── Top leads by score ────────────────────────────────────────────────────
  const topLeads = db.prepare(`
    SELECT id, name, platform, category, search_location,
           lead_score, lead_priority, has_website, website_quality,
           contact_reason, business_diagnosis, estimated_value,
           phone, email, status, opportunity_summary
    FROM leads
    WHERE lead_score IS NOT NULL
    ORDER BY lead_score DESC
    LIMIT 10
  `).all();

  // ── Active businesses without website ─────────────────────────────────────
  const activeNoWeb = db.prepare(`
    SELECT id, name, platform, category, search_location,
           lead_score, lead_priority, has_website,
           contact_reason, estimated_value, phone, email, status
    FROM leads
    WHERE has_website = 0
      AND (phone IS NOT NULL OR email IS NOT NULL OR description IS NOT NULL)
      AND lead_score IS NOT NULL
    ORDER BY lead_score DESC
    LIMIT 10
  `).all();

  // ── High-value leads not yet contacted ────────────────────────────────────
  const freshOpportunities = db.prepare(`
    SELECT id, name, platform, category, search_location,
           lead_score, lead_priority, has_website, website_quality,
           contact_reason, estimated_value, status
    FROM leads
    WHERE status = 'not_contacted'
      AND lead_priority = 'high'
    ORDER BY lead_score DESC, created_at DESC
    LIMIT 10
  `).all();

  // ── Niche analysis: categories with most opportunities ────────────────────
  const topNiches = db.prepare(`
    SELECT
      category,
      COUNT(*) as total,
      SUM(CASE WHEN has_website = 0 THEN 1 ELSE 0 END) as no_website,
      SUM(CASE WHEN website_quality IN ('poor','needs_improvement') THEN 1 ELSE 0 END) as weak_website,
      ROUND(AVG(CASE WHEN lead_score IS NOT NULL THEN lead_score END), 1) as avg_score
    FROM leads
    WHERE category IS NOT NULL
    GROUP BY category
    HAVING total >= 2
    ORDER BY (no_website + weak_website) DESC, avg_score DESC
    LIMIT 12
  `).all() as {
    category: string;
    total: number;
    no_website: number;
    weak_website: number;
    avg_score: number;
  }[];

  // ── Top locations by opportunity density ──────────────────────────────────
  const topLocations = db.prepare(`
    SELECT
      search_location,
      COUNT(*) as total,
      SUM(CASE WHEN has_website = 0 THEN 1 ELSE 0 END) as no_website,
      SUM(CASE WHEN lead_priority = 'high' THEN 1 ELSE 0 END) as high_priority,
      ROUND(AVG(CASE WHEN lead_score IS NOT NULL THEN lead_score END), 1) as avg_score
    FROM leads
    GROUP BY search_location
    ORDER BY no_website DESC, high_priority DESC
    LIMIT 8
  `).all() as {
    search_location: string;
    total: number;
    no_website: number;
    high_priority: number;
    avg_score: number;
  }[];

  // ── Summary stats ─────────────────────────────────────────────────────────
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN has_website = 0 THEN 1 ELSE 0 END) as no_website,
      SUM(CASE WHEN lead_priority = 'high' THEN 1 ELSE 0 END) as high_priority,
      SUM(CASE WHEN status = 'not_contacted' AND lead_priority = 'high' THEN 1 ELSE 0 END) as untouched_high,
      SUM(CASE WHEN estimated_value = 'high' THEN 1 ELSE 0 END) as high_value
    FROM leads
  `).get() as {
    total: number;
    no_website: number;
    high_priority: number;
    untouched_high: number;
    high_value: number;
  };

  return NextResponse.json({
    stats,
    topLeads,
    activeNoWeb,
    freshOpportunities,
    topNiches,
    topLocations,
  });
}
