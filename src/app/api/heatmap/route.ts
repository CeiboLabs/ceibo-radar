import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  const byLocation = db
    .prepare(
      `SELECT
        search_location AS location,
        location_region AS region,
        COUNT(*) AS total,
        SUM(CASE WHEN has_website = 0 THEN 1 ELSE 0 END) AS no_website,
        SUM(CASE WHEN website_quality = 'poor' THEN 1 ELSE 0 END) AS poor_website,
        SUM(CASE WHEN is_hot = 1 THEN 1 ELSE 0 END) AS hot_leads,
        ROUND(AVG(CAST(lead_score AS REAL))) AS avg_score
      FROM leads
      WHERE search_location IS NOT NULL
      GROUP BY search_location
      ORDER BY (no_website + poor_website) DESC
      LIMIT 15`
    )
    .all();

  const byCategory = db
    .prepare(
      `SELECT
        category,
        COUNT(*) AS total,
        SUM(CASE WHEN has_website = 0 THEN 1 ELSE 0 END) AS no_website,
        SUM(CASE WHEN website_quality = 'poor' THEN 1 ELSE 0 END) AS poor_website,
        SUM(CASE WHEN is_hot = 1 THEN 1 ELSE 0 END) AS hot_leads,
        ROUND(AVG(CAST(lead_score AS REAL))) AS avg_score
      FROM leads
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY (no_website + poor_website) DESC
      LIMIT 15`
    )
    .all();

  return NextResponse.json({ by_location: byLocation, by_category: byCategory });
}
