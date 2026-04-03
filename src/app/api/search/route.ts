import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { scrapeGoogleMaps } from "@/lib/scrapers/google-maps";
import { scrapeInstagram } from "@/lib/scrapers/instagram";
import { extractContactsFromHtml, extractContactsFromText } from "@/lib/scrapers/contact-extractor";
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

// ─── Fuzzy name deduplication ─────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(s\.?a\.?|s\.?r\.?l\.?|ltda|srl|sa)\b/gi, "")
    .replace(/\s+/g, " ").trim();
}

function isSimilarName(a: string, b: string, threshold = 0.82): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  const wordsA = new Set(na.split(" ").filter(w => w.length > 2));
  const wordsB = new Set(nb.split(" ").filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union >= threshold;
}

// ─── Website analysis result ──────────────────────────────────────────────────

interface WebsiteInfo {
  hasWebsite: boolean;
  websiteUrl: string | null;
  websiteQuality: WebsiteQuality | null;
  websiteQualityScore: number | null;
  websiteQualityIssuesParsed: string[];
  websiteQualityIssuesStr: string | null;
  websiteQualitySummary: string | null;
  cmsType: string | null;
}

const EMPTY_WEBSITE: WebsiteInfo = {
  hasWebsite: false,
  websiteUrl: null,
  websiteQuality: null,
  websiteQualityScore: null,
  websiteQualityIssuesParsed: [],
  websiteQualityIssuesStr: null,
  websiteQualitySummary: null,
  cmsType: null,
};

async function analyzeWebsiteData(url: string | undefined): Promise<WebsiteInfo> {
  if (!url) return EMPTY_WEBSITE;

  const isLive = await checkWebsite(url);
  if (!isLive) return EMPTY_WEBSITE;

  const analysis = await analyzeWebsite(url);
  return {
    hasWebsite: true,
    websiteUrl: url,
    websiteQuality: analysis.quality,
    websiteQualityScore: analysis.score,
    websiteQualityIssuesParsed: analysis.issues,
    websiteQualityIssuesStr: JSON.stringify(analysis.issues),
    websiteQualitySummary: analysis.summary,
    cmsType: analysis.cms_type,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

const WEBSITE_BATCH_SIZE = 5;

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
  const maxLeads: number = (body.maxLeads as number) ?? 20;
  // Derive scraper depth from maxLeads: ~3.5 results per scroll
  const maxScrolls = Math.max(3, Math.ceil(maxLeads / 3));
  const instagramQueryCount = maxLeads <= 10 ? 1 : maxLeads <= 25 ? 2 : 3;

  if (!keyword || !locations.length || !platforms.length) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const send = async (data: object) => {
    try {
      await writer.write(encoder.encode(JSON.stringify(data) + "\n"));
    } catch {}
  };

  (async () => {
    // Load existing leads for deduplication (URL + fuzzy name)
    const { data: existingRows } = await supabase.from("leads").select("profile_url, name, search_location");
    const existingUrls = new Set<string>((existingRows ?? []).map((r) => r.profile_url));
    // Map: normalized_location → array of normalized names
    const existingNamesByLocation = new Map<string, string[]>();
    for (const r of (existingRows ?? [])) {
      const locKey = normalizeName(r.search_location ?? "");
      if (!existingNamesByLocation.has(locKey)) existingNamesByLocation.set(locKey, []);
      existingNamesByLocation.get(locKey)!.push(normalizeName(r.name ?? ""));
    }

    const allSaved: Array<{ has_website: boolean; website_quality: string | null }> = [];

    for (const location of locations) {
      const byPlatform: ScrapedBusiness[][] = [];

      if (platforms.includes("google_maps")) {
        await send({ type: "progress", message: `Buscando "${keyword}" en Google Maps (${location})...` });
        try {
          const results = await scrapeGoogleMaps(keyword, location, maxScrolls);
          byPlatform.push(results);
          await send({ type: "progress", message: `Google Maps (${location}): ${results.length} negocios` });
        } catch {
          await send({ type: "progress", message: `Google Maps (${location}): error al buscar` });
        }
      }

      if (platforms.includes("instagram")) {
        await send({ type: "progress", message: `Buscando "${keyword}" en Instagram (${location})...` });
        try {
          const results = await scrapeInstagram(keyword, location, instagramQueryCount);
          byPlatform.push(results);
          await send({ type: "progress", message: `Instagram (${location}): ${results.length} perfiles` });
        } catch {
          await send({ type: "progress", message: `Instagram (${location}): error al buscar` });
        }
      }

      // Interleave results so both platforms are represented fairly before capping
      const scraped: ScrapedBusiness[] = [];
      const maxLen = Math.max(...byPlatform.map(a => a.length), 0);
      for (let i = 0; i < maxLen; i++) {
        for (const arr of byPlatform) {
          if (i < arr.length) scraped.push(arr[i]);
        }
      }

      if (scraped.length === 0) continue;

      // ── Deduplication: skip by URL or fuzzy name match ────────────────────
      const locKey = normalizeName(location);
      const locationNames = existingNamesByLocation.get(locKey) ?? [];
      const newBusinesses = scraped.filter((b) => {
        if (existingUrls.has(b.profile_url)) return false;
        const normB = normalizeName(b.name);
        return !locationNames.some(existingNorm => isSimilarName(normB, existingNorm));
      });
      const skipped = scraped.length - newBusinesses.length;

      if (skipped > 0) {
        await send({
          type: "progress",
          message: `${location}: ${newBusinesses.length} nuevos, ${skipped} ya existentes (omitidos)`,
        });
      }

      if (newBusinesses.length === 0) continue;

      // Cap to maxLeads per location
      const capped = newBusinesses.splice(maxLeads);
      if (capped.length > 0) {
        await send({
          type: "progress",
          message: `${location}: limitando a ${maxLeads} leads (${capped.length} descartados por límite)`,
        });
      }

      // Mark as seen immediately so parallel locations don't reprocess
      newBusinesses.forEach((b) => {
        existingUrls.add(b.profile_url);
        locationNames.push(normalizeName(b.name));
      });
      if (!existingNamesByLocation.has(locKey)) existingNamesByLocation.set(locKey, locationNames);

      // ── Parallel website analysis (batches of 5) ───────────────────────────
      await send({
        type: "progress",
        message: `Analizando ${newBusinesses.length} sitios web de ${location}...`,
      });

      const websiteInfos: WebsiteInfo[] = [];
      for (let i = 0; i < newBusinesses.length; i += WEBSITE_BATCH_SIZE) {
        const batch = newBusinesses.slice(i, i + WEBSITE_BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map((b) => analyzeWebsiteData(b.website_url))
        );
        for (const r of batchResults) {
          websiteInfos.push(r.status === "fulfilled" ? r.value : { ...EMPTY_WEBSITE });
        }

        const analyzed = Math.min(i + WEBSITE_BATCH_SIZE, newBusinesses.length);
        if (analyzed < newBusinesses.length) {
          await send({
            type: "progress",
            message: `Analizando sitios web... ${analyzed}/${newBusinesses.length}`,
          });
        }
      }

      // ── Enrich and insert ─────────────────────────────────────────────────
      await send({
        type: "progress",
        message: `Procesando y guardando ${newBusinesses.length} negocios de ${location}...`,
      });

      for (let idx = 0; idx < newBusinesses.length; idx++) {
        const business = newBusinesses[idx];
        const wi = websiteInfos[idx];

        // Enrich contact data from website HTML if missing
        let enrichedPhone = business.phone ?? null;
        let enrichedEmail = business.email ?? null;

        if (wi.hasWebsite && wi.websiteUrl && (!enrichedPhone || !enrichedEmail)) {
          try {
            const websiteRes = await fetch(wi.websiteUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; CeiboBot/1.0)" },
              signal: AbortSignal.timeout(8000),
            });
            if (websiteRes.ok) {
              const html = await websiteRes.text();
              const extracted = extractContactsFromHtml(html, { phone: enrichedPhone, email: enrichedEmail });
              if (extracted.phone && !enrichedPhone) enrichedPhone = extracted.phone;
              if (extracted.email && !enrichedEmail) enrichedEmail = extracted.email;
            }
          } catch {
            // Ignore errors — contact enrichment is best-effort
          }
        }

        // Extract from Instagram bio if platform is instagram
        if (business.platform === "instagram" && business.description) {
          const extracted = extractContactsFromText(business.description, { phone: enrichedPhone, email: enrichedEmail });
          if (extracted.phone && !enrichedPhone) enrichedPhone = extracted.phone;
          if (extracted.email && !enrichedEmail) enrichedEmail = extracted.email;
        }

        // Scoring
        const { score, priority, breakdown } = scorelead({
          has_website: wi.hasWebsite,
          website_quality: wi.websiteQuality,
          phone: enrichedPhone ?? undefined,
          email: enrichedEmail ?? undefined,
          location: business.location ?? location,
          description: business.description,
          platform: business.platform,
          category: business.category,
        });

        // Enrichment
        const enrichment = enrichLead({
          has_website: wi.hasWebsite,
          website_quality: wi.websiteQuality,
          platform: business.platform,
          description: business.description ?? null,
          phone: enrichedPhone,
          email: enrichedEmail,
          location: business.location ?? null,
          category: business.category ?? null,
        });

        // Opportunities
        const { opportunities, summary: opSummary } = detectOpportunities({
          name: business.name,
          has_website: wi.hasWebsite,
          website_quality: wi.websiteQuality,
          website_quality_issues: wi.websiteQualityIssuesParsed,
          platform: business.platform,
          description: business.description ?? null,
          phone: enrichedPhone,
          email: enrichedEmail,
          location: business.location ?? null,
        });

        // Auto-tags
        const autoTags = computeAutoTags({
          has_website: wi.hasWebsite,
          website_quality: wi.websiteQuality,
          platform: business.platform,
          description: business.description ?? null,
          phone: enrichedPhone,
          email: enrichedEmail,
          location: business.location ?? null,
          lead_score: score,
          enrichment,
          opportunities,
        });

        // Sales intelligence
        const contactReason = generateContactReason({
          has_website: wi.hasWebsite,
          website_quality: wi.websiteQuality,
          platform: business.platform,
          description: business.description ?? null,
          phone: enrichedPhone,
          email: enrichedEmail,
          category: business.category ?? null,
        });

        const businessDiagnosis = generateDiagnosis({
          has_website: wi.hasWebsite,
          website_quality: wi.websiteQuality,
          platform: business.platform,
          description: business.description ?? null,
          phone: enrichedPhone,
          email: enrichedEmail,
          enrichment,
        });

        const { value: estimatedValue } = estimateClientValue({
          category: business.category ?? null,
          has_website: wi.hasWebsite,
          website_quality: wi.websiteQuality,
          platform: business.platform,
          description: business.description ?? null,
          location: business.location ?? null,
          enrichment,
        });

        // Compute difficulty once (was computed twice before)
        const difficultyLevel = computeDifficulty(
          {
            has_website: wi.hasWebsite,
            website_quality: wi.websiteQuality,
            phone: enrichedPhone,
            email: enrichedEmail,
          },
          enrichment
        );

        const parsedLocation = parseLocation(location);

        try {
          const { data: inserted } = await supabase
            .from("leads")
            .upsert(
              {
                name: business.name,
                platform: business.platform,
                profile_url: business.profile_url,
                phone: enrichedPhone,
                email: enrichedEmail,
                location: business.location ?? location,
                description: business.description ?? null,
                category: business.category ?? null,
                enrichment_data: JSON.stringify(enrichment),
                opportunities: JSON.stringify(opportunities),
                opportunity_summary: opSummary,
                tags: JSON.stringify(autoTags),
                has_website: wi.hasWebsite,
                website_url: wi.websiteUrl,
                website_quality: wi.websiteQuality,
                website_quality_score: wi.websiteQualityScore,
                website_quality_issues: wi.websiteQualityIssuesStr,
                website_quality_summary: wi.websiteQualitySummary,
                lead_score: score,
                lead_priority: priority,
                lead_score_breakdown: JSON.stringify(breakdown),
                contact_reason: contactReason,
                business_diagnosis: businessDiagnosis,
                estimated_value: estimatedValue,
                is_hot: isHotLead({
                  lead_priority: priority,
                  lead_score: score,
                  has_website: wi.hasWebsite,
                  website_quality: wi.websiteQuality,
                  phone: enrichedPhone,
                  email: enrichedEmail,
                  sequence_stage: "none",
                }),
                difficulty_level: difficultyLevel,
                segment_tags: JSON.stringify(
                  computeSegments(
                    {
                      lead_priority: priority,
                      lead_score: score,
                      has_website: wi.hasWebsite,
                      website_quality: wi.websiteQuality,
                      estimated_value: estimatedValue,
                      ai_premium_tier: null,
                      platform: business.platform,
                      phone: enrichedPhone,
                      email: enrichedEmail,
                      status: "not_contacted",
                    },
                    difficultyLevel
                  )
                ),
                location_city: parsedLocation.city,
                location_region: parsedLocation.region,
                location_country: parsedLocation.country,
                rating: business.rating ?? null,
                review_count: business.review_count ?? null,
                cms_type: wi.cmsType,
                status: "not_contacted",
                sequence_stage: "none",
                keyword,
                search_location: location,
              },
              { onConflict: "profile_url", ignoreDuplicates: true }
            )
            .select("id");

          if (inserted && inserted.length > 0) {
            allSaved.push({ has_website: wi.hasWebsite, website_quality: wi.websiteQuality });
            await send({
              type: "progress",
              message: `✓ ${business.name}${wi.hasWebsite ? ` (web: ${wi.websiteQuality})` : " (sin web)"}${business.rating ? ` ★${business.rating}` : ""}`,
            });
          }
        } catch (e) {
          console.error("[search] upsert error for", business.name, e);
          await send({ type: "progress", message: `✗ Error guardando ${business.name}: ${e instanceof Error ? e.message : String(e)}` });
        }
      }
    }

    await send({
      type: "done",
      total: allSaved.length,
      no_website: allSaved.filter((l) => !l.has_website).length,
      bad_website: allSaved.filter(
        (l) =>
          l.website_quality === "poor" || l.website_quality === "needs_improvement"
      ).length,
    });
    await writer.close();
  })();

  return new Response(stream.readable, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
