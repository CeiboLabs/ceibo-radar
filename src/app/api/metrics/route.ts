import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  const total = (db.prepare("SELECT COUNT(*) as n FROM leads").get() as { n: number }).n;
  const noWebsite = (db.prepare("SELECT COUNT(*) as n FROM leads WHERE has_website = 0").get() as { n: number }).n;
  const poorWebsite = (db.prepare("SELECT COUNT(*) as n FROM leads WHERE website_quality = 'poor'").get() as { n: number }).n;
  const weakWebsite = (db.prepare("SELECT COUNT(*) as n FROM leads WHERE website_quality = 'needs_improvement'").get() as { n: number }).n;
  const goodWebsite = (db.prepare("SELECT COUNT(*) as n FROM leads WHERE website_quality = 'good'").get() as { n: number }).n;

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM leads GROUP BY status
  `).all() as { status: string; count: number }[];

  const byPriority = db.prepare(`
    SELECT lead_priority, COUNT(*) as count FROM leads WHERE lead_priority IS NOT NULL GROUP BY lead_priority
  `).all() as { lead_priority: string; count: number }[];

  const byPlatform = db.prepare(`
    SELECT platform, COUNT(*) as count FROM leads GROUP BY platform
  `).all() as { platform: string; count: number }[];

  const byLocation = db.prepare(`
    SELECT search_location, COUNT(*) as count FROM leads GROUP BY search_location ORDER BY count DESC LIMIT 10
  `).all() as { search_location: string; count: number }[];

  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count FROM leads WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 10
  `).all() as { category: string; count: number }[];

  const topLeads = db.prepare(`
    SELECT id, name, lead_score, lead_priority, has_website, website_quality, status
    FROM leads WHERE lead_score IS NOT NULL
    ORDER BY lead_score DESC LIMIT 5
  `).all();

  const campaignCount = (db.prepare("SELECT COUNT(*) as n FROM campaigns").get() as { n: number }).n;

  return NextResponse.json({
    total,
    noWebsite,
    poorWebsite,
    weakWebsite,
    goodWebsite,
    opportunities: noWebsite + poorWebsite + weakWebsite,
    byStatus,
    byPriority,
    byPlatform,
    byLocation,
    byCategory,
    topLeads,
    campaignCount,
  });
}
