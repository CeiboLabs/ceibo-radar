import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { scrapeGoogleMaps } from "@/lib/scrapers/google-maps";
import { scrapeInstagram } from "@/lib/scrapers/instagram";
import { checkWebsite } from "@/lib/scrapers/website-checker";
import { analyzeWebsite } from "@/lib/scrapers/website-quality";
import { scorelead } from "@/lib/lead-score";
import { enrichLead } from "@/lib/enrichment";
import { detectOpportunities } from "@/lib/opportunities";
import { computeAutoTags } from "@/lib/auto-tagger";
import { generateContactReason } from "@/lib/contact-reason";
import { generateDiagnosis } from "@/lib/diagnosis";
import { estimateClientValue } from "@/lib/value-estimator";
import { isHotLead } from "@/lib/sales/hotLeadDetector";
import { computeDifficulty } from "@/lib/sales/difficultyEngine";
import { computeSegments } from "@/lib/sales/segmentationEngine";
import { parseLocation } from "@/lib/location";
import type { Platform, ScrapedBusiness, SearchConfig, WebsiteQuality } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config = body as SearchConfig & { location?: string };

  const keyword = config.keyword?.trim();
  const locations: string[] = config.locations?.length
    ? config.locations.map((l) => l.trim()).filter(Boolean)
    : config.location
    ? [config.location.trim()]
    : [];
  const platforms: Platform[] = config.platforms ?? [];
  const maxScrolls = config.maxScrolls ?? 8;

  if (!keyword || !locations.length || !platforms.length) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const instagramQueryCount = maxScrolls <= 5 ? 1 : maxScrolls <= 12 ? 2 : 3;

  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const send = async (data: object) => {
    try {
      await writer.write(encoder.encode(JSON.stringify(data) + "\n"));
    } catch {}
  };

  (async () => {
    const db = getDb();
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO leads (
        name, platform, profile_url, phone, email, location,
        description, category,
        enrichment_data, opportunities, opportunity_summary, tags,
        has_website, website_url,
        website_quality, website_quality_score, website_quality_issues, website_quality_summary,
        lead_score, lead_priority, lead_score_breakdown,
        contact_reason, business_diagnosis, estimated_value,
        is_hot, difficulty_level, segment_tags,
        location_city, location_region, location_country,
        status, sequence_stage, keyword, search_location
      ) VALUES (
        @name, @platform, @profile_url, @phone, @email, @location,
        @description, @category,
        @enrichment_data, @opportunities, @opportunity_summary, @tags,
        @has_website, @website_url,
        @website_quality, @website_quality_score, @website_quality_issues, @website_quality_summary,
        @lead_score, @lead_priority, @lead_score_breakdown,
        @contact_reason, @business_diagnosis, @estimated_value,
        @is_hot, @difficulty_level, @segment_tags,
        @location_city, @location_region, @location_country,
        'not_contacted', 'none', @keyword, @search_location
      )
    `);

    const allSaved: Array<{ has_website: boolean; website_quality: string | null }> = [];

    for (const location of locations) {
      const scraped: ScrapedBusiness[] = [];

      if (platforms.includes("google_maps")) {
        await send({ type: "progress", message: `Buscando "${keyword}" en Google Maps (${location})...` });
        try {
          const results = await scrapeGoogleMaps(keyword, location, maxScrolls);
          scraped.push(...results);
          await send({ type: "progress", message: `Google Maps (${location}): ${results.length} negocios` });
        } catch {
          await send({ type: "progress", message: `Google Maps (${location}): error al buscar` });
        }
      }

      if (platforms.includes("instagram")) {
        await send({ type: "progress", message: `Buscando "${keyword}" en Instagram (${location})...` });
        try {
          const results = await scrapeInstagram(keyword, location, instagramQueryCount);
          scraped.push(...results);
          await send({ type: "progress", message: `Instagram (${location}): ${results.length} perfiles` });
        } catch {
          await send({ type: "progress", message: `Instagram (${location}): error al buscar` });
        }
      }

      if (scraped.length === 0) continue;

      await send({ type: "progress", message: `Analizando ${scraped.length} negocios de ${location}...` });

      for (const business of scraped) {
        // ── Website analysis ──────────────────────────────────────────────
        let hasWebsite = false;
        let websiteUrl = business.website_url ?? null;
        let websiteQuality: WebsiteQuality | null = null;
        let websiteQualityScore: number | null = null;
        let websiteQualityIssuesStr: string | null = null;
        let websiteQualityIssuesParsed: string[] = [];
        let websiteQualitySummary: string | null = null;

        if (websiteUrl) {
          hasWebsite = await checkWebsite(websiteUrl);
          if (hasWebsite) {
            const analysis = await analyzeWebsite(websiteUrl);
            websiteQuality = analysis.quality;
            websiteQualityScore = analysis.score;
            websiteQualityIssuesParsed = analysis.issues;
            websiteQualityIssuesStr = JSON.stringify(analysis.issues);
            websiteQualitySummary = analysis.summary;
          } else {
            websiteUrl = null;
          }
        }

        // ── Scoring ───────────────────────────────────────────────────────
        const { score, priority, breakdown } = scorelead({
          has_website: hasWebsite,
          website_quality: websiteQuality,
          phone: business.phone,
          email: business.email,
          location: business.location ?? location,
          description: business.description,
          platform: business.platform,
          category: business.category,
        });

        // ── Enrichment ────────────────────────────────────────────────────
        const enrichment = enrichLead({
          has_website: hasWebsite,
          website_quality: websiteQuality,
          platform: business.platform,
          description: business.description ?? null,
          phone: business.phone ?? null,
          email: business.email ?? null,
          location: business.location ?? null,
          category: business.category ?? null,
        });

        // ── Opportunities ─────────────────────────────────────────────────
        const { opportunities, summary: opSummary } = detectOpportunities({
          name: business.name,
          has_website: hasWebsite,
          website_quality: websiteQuality,
          website_quality_issues: websiteQualityIssuesParsed,
          platform: business.platform,
          description: business.description ?? null,
          phone: business.phone ?? null,
          email: business.email ?? null,
          location: business.location ?? null,
        });

        // ── Auto-tags ─────────────────────────────────────────────────────
        const autoTags = computeAutoTags({
          has_website: hasWebsite,
          website_quality: websiteQuality,
          platform: business.platform,
          description: business.description ?? null,
          phone: business.phone ?? null,
          email: business.email ?? null,
          location: business.location ?? null,
          lead_score: score,
          enrichment,
          opportunities,
        });

        // ── Sales intelligence ─────────────────────────────────────────────
        const contactReason = generateContactReason({
          has_website: hasWebsite,
          website_quality: websiteQuality,
          platform: business.platform,
          description: business.description ?? null,
          phone: business.phone ?? null,
          email: business.email ?? null,
          category: business.category ?? null,
        });

        const businessDiagnosis = generateDiagnosis({
          has_website: hasWebsite,
          website_quality: websiteQuality,
          platform: business.platform,
          description: business.description ?? null,
          phone: business.phone ?? null,
          email: business.email ?? null,
          enrichment,
        });

        const { value: estimatedValue } = estimateClientValue({
          category: business.category ?? null,
          has_website: hasWebsite,
          website_quality: websiteQuality,
          platform: business.platform,
          description: business.description ?? null,
          location: business.location ?? null,
          enrichment,
        });

        // ── Insert ────────────────────────────────────────────────────────
        try {
          const result = insertStmt.run({
            name: business.name,
            platform: business.platform,
            profile_url: business.profile_url,
            phone: business.phone ?? null,
            email: business.email ?? null,
            location: business.location ?? location,
            description: business.description ?? null,
            category: business.category ?? null,
            enrichment_data: JSON.stringify(enrichment),
            opportunities: JSON.stringify(opportunities),
            opportunity_summary: opSummary,
            tags: JSON.stringify(autoTags),
            has_website: hasWebsite ? 1 : 0,
            website_url: websiteUrl,
            website_quality: websiteQuality,
            website_quality_score: websiteQualityScore,
            website_quality_issues: websiteQualityIssuesStr,
            website_quality_summary: websiteQualitySummary,
            lead_score: score,
            lead_priority: priority,
            lead_score_breakdown: JSON.stringify(breakdown),
            contact_reason: contactReason,
            business_diagnosis: businessDiagnosis,
            estimated_value: estimatedValue,
            is_hot: isHotLead({
              lead_priority: priority,
              lead_score: score,
              has_website: hasWebsite,
              website_quality: websiteQuality,
              phone: business.phone ?? null,
              email: business.email ?? null,
              sequence_stage: "none",
            }) ? 1 : 0,
            difficulty_level: computeDifficulty(
              { has_website: hasWebsite, website_quality: websiteQuality, phone: business.phone ?? null, email: business.email ?? null },
              enrichment
            ),
            segment_tags: (() => {
              const diffLevel = computeDifficulty(
                { has_website: hasWebsite, website_quality: websiteQuality, phone: business.phone ?? null, email: business.email ?? null },
                enrichment
              );
              return JSON.stringify(computeSegments(
                {
                  lead_priority: priority, lead_score: score,
                  has_website: hasWebsite, website_quality: websiteQuality,
                  estimated_value: estimatedValue, ai_premium_tier: null,
                  platform: business.platform, phone: business.phone ?? null,
                  email: business.email ?? null, status: "not_contacted",
                },
                diffLevel
              ));
            })(),
            ...(() => {
              const loc = parseLocation(location);
              return { location_city: loc.city, location_region: loc.region, location_country: loc.country };
            })(),
            keyword,
            search_location: location,
          });
          if (result.changes > 0) {
            allSaved.push({ has_website: hasWebsite, website_quality: websiteQuality });
          }
        } catch {}
      }
    }

    await send({
      type: "done",
      total: allSaved.length,
      no_website: allSaved.filter((l) => !l.has_website).length,
      bad_website: allSaved.filter(
        (l) => l.website_quality === "poor" || l.website_quality === "needs_improvement"
      ).length,
    });
    await writer.close();
  })();

  return new Response(stream.readable, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
