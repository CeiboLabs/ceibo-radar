import type { ScrapedBusiness } from "../types";
import { bingSearch } from "./bing-search";

// ─── Bing-based search for Páginas Amarillas ──────────────────────────────────
// The paginasamarillas.com.uy site requires JS rendering and blocks direct
// scraping from server environments. We use Bing search (better coverage than
// DuckDuckGo for Uruguayan directories) to surface listings.

function extractPhoneFromText(text: string): string | null {
  const patterns = [
    /\b(09\d[\s-]?\d{3}[\s-]?\d{3})\b/g,             // 09x xxx xxx (mobile UY)
    /\b(\+598[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{3})\b/g, // +598...
    /\b(2\d{3}[\s-]?\d{4})\b/g,                        // 2xxx xxxx Montevideo
    /\b(4\d{3}[\s-]?\d{4})\b/g,                        // 4xxx xxxx interior
    /\b(\d{4}[\s-]\d{4})\b/g,                           // xxxx xxxx generic
    /Tel[eé]fono[:\s]+([0-9\s\-+()]{7,15})/i,
    /Tel[.:\s]+([0-9\s\-+()]{7,15})/i,
    /Fono[:\s]+([0-9\s\-+()]{7,15})/i,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      const phone = (match[1] ?? match[0]).replace(/\s+/g, " ").trim();
      if (phone.replace(/\D/g, "").length >= 7) return phone;
    }
  }
  return null;
}

function extractWebsiteFromText(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s\n\r,;'"<>()[\]{}|\\^`]+/gi;
  const matches = text.match(urlRegex);
  if (!matches) return null;

  const socialDomains = [
    "paginasamarillas.com.uy",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "youtube.com",
    "wa.me",
    "bing.com",
  ];
  return (
    matches.find((url) => !socialDomains.some((d) => url.includes(d))) ?? null
  );
}

interface PAListing {
  name: string;
  phone: string | null;
  address: string | null;
  website_url: string | null;
  profile_url: string;
  description: string | null;
}

function parsePAFromBing(
  title: string,
  url: string,
  snippet: string,
  seen: Set<string>
): PAListing | null {
  if (!url.includes("paginasamarillas.com.uy")) return null;

  const urlKey = url.toLowerCase().replace(/\/$/, "");
  if (seen.has(urlKey)) return null;
  seen.add(urlKey);

  // Clean title: remove "| Páginas Amarillas Uruguay" suffixes
  const name = title
    .replace(/[|\-–]\s*(P[aá]ginas\s*Amarillas|paginasamarillas)[^\n]*/gi, "")
    .replace(/\s*[-–]\s*Uruguay\s*$/i, "")
    .trim();

  if (!name || name.length < 2) return null;

  const phone = extractPhoneFromText(snippet);
  const website_url = extractWebsiteFromText(snippet);

  let address: string | null = null;
  const addressMatch = snippet.match(
    /(?:Dirección[:\s]+|📍\s*)([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+\s+\d+[^,.\n]*(?:,\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+)?)/
  );
  if (addressMatch) address = addressMatch[1].trim();

  return { name, phone, address, website_url, profile_url: url, description: snippet || null };
}

export async function scrapePaginasAmarillas(
  keyword: string,
  location: string,
  _maxPages = 3
): Promise<ScrapedBusiness[]> {
  console.log(`[PáginasAmarillas] Starting search: "${keyword}" in "${location}"`);

  // NOTE: site: operator returns 0 results from server IPs on Bing.
  // Use plain keyword queries and filter by domain programmatically.
  const queries = [
    `${keyword} ${location} paginasamarillas.com.uy`,
    `"${keyword}" Uruguay paginasamarillas.com.uy`,
    `${keyword} ${location} páginas amarillas uruguay`,
  ];

  const seen = new Set<string>();
  const allListings: PAListing[] = [];

  for (let qi = 0; qi < queries.length; qi++) {
    const query = queries[qi];
    console.log(`[PáginasAmarillas] Bing query (${qi + 1}/${queries.length}): ${query}`);

    const results = await bingSearch(query, 30);
    console.log(`[PáginasAmarillas] Bing returned ${results.length} results`);

    for (const r of results) {
      const listing = parsePAFromBing(r.title, r.url, r.snippet, seen);
      if (listing) {
        allListings.push(listing);
        console.log(
          `[PáginasAmarillas] ✓ ${listing.name} | tel: ${listing.phone ?? "none"} | web: ${listing.website_url ?? "none"}`
        );
      }
    }

    if (qi < queries.length - 1) {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 800));
    }
  }

  console.log(`[PáginasAmarillas] Done — ${allListings.length} listings found`);

  return allListings.map((l) => ({
    name: l.name,
    platform: "paginas_amarillas" as const,
    profile_url: l.profile_url,
    phone: l.phone ?? undefined,
    location: l.address ?? location,
    description: l.description ?? undefined,
    category: keyword,
    website_url: l.website_url ?? undefined,
  }));
}
