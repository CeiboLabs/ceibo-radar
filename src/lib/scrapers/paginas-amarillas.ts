import type { ScrapedBusiness } from "../types";

// ─── DDG-based search for Páginas Amarillas ───────────────────────────────────
// The paginasamarillas.com.uy site requires JS rendering, so we use DDG to
// surface listings and extract business data from titles/snippets.

const DDG_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-UY,es;q=0.9,en;q=0.8",
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPhoneFromText(text: string): string | null {
  // Uruguayan phone patterns: 09x xxx xxx (mobile), 2xxx xxxx (Mvd landline), 4xxx xxxx (interior)
  const patterns = [
    /\b(09\d[\s-]?\d{3}[\s-]?\d{3})\b/g,          // 09x xxx xxx
    /\b(\d{4}[\s-]\d{4})\b/g,                       // xxxx xxxx
    /\b(\+598[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{3})\b/g, // +598...
    /\b(2\d{3}[\s-]?\d{4})\b/g,                     // 2xxx xxxx Montevideo
    /\b(4\d{3}[\s-]?\d{4})\b/g,                     // 4xxx xxxx interior
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
    "duckduckgo.com",
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

async function ddgFetchPAPage(
  query: string,
  seen: Set<string>,
  page: number
): Promise<PAListing[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let res: Response;

    if (page === 0) {
      const url = `https://html.duckduckgo.com/html/?${new URLSearchParams({ q: query }).toString()}`;
      res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: DDG_HEADERS,
      });
    } else {
      const s = String(page * 10 + 1);
      const formBody = new URLSearchParams({
        q: query,
        s,
        nextParams: "",
        v: "l",
        o: "json",
        dc: String(page * 10 + 2),
      });
      res = await fetch("https://html.duckduckgo.com/html/", {
        method: "POST",
        signal: controller.signal,
        headers: {
          ...DDG_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://html.duckduckgo.com",
          Referer: "https://html.duckduckgo.com/",
        },
        body: formBody.toString(),
      });
    }

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[PáginasAmarillas] DDG p${page + 1} returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    console.log(`[PáginasAmarillas] DDG p${page + 1} HTML length: ${html.length}`);

    return parsePAListingsFromDDG(html, seen);
  } catch (err) {
    console.error(
      `[PáginasAmarillas] DDG p${page + 1} failed:`,
      (err as Error).message
    );
    return [];
  }
}

function parsePAListingsFromDDG(
  html: string,
  seen: Set<string>
): PAListing[] {
  const listings: PAListing[] = [];

  // Match result blocks that contain paginasamarillas.com.uy URLs
  const resultBlockPattern =
    /class="result__a"[^>]*href="([^"]*paginasamarillas\.com\.uy[^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = resultBlockPattern.exec(html)) !== null) {
    const rawHref = match[1];
    const titleHtml = match[2];
    const snippetHtml = match[3];

    // Extract the real URL from DDG redirect
    let profileUrl = rawHref;
    const uddgMatch = rawHref.match(/uddg=(https?[^&"]+)/i);
    if (uddgMatch) {
      try {
        profileUrl = decodeURIComponent(uddgMatch[1]);
      } catch {
        profileUrl = uddgMatch[1];
      }
    }

    // Only keep actual business listing pages (not category/search pages)
    if (!profileUrl.includes("paginasamarillas.com.uy")) continue;

    // Deduplicate by URL
    const urlKey = profileUrl.toLowerCase().replace(/\/$/, "");
    if (seen.has(urlKey)) continue;
    seen.add(urlKey);

    const titleText = stripHtml(titleHtml);
    const snippetText = stripHtml(snippetHtml);

    // Clean title: remove "| Páginas Amarillas", "- Páginas Amarillas Uruguay" etc.
    const name = titleText
      .replace(/[|\-–]\s*(Páginas Amarillas|PáginasAmarillas|paginasamarillas)[^]*/gi, "")
      .replace(/\s*-\s*Uruguay\s*$/i, "")
      .trim();

    if (!name || name.length < 2) continue;

    const phone = extractPhoneFromText(snippetText);
    const website_url = extractWebsiteFromText(snippetText);

    // Try to extract address from snippet (look for street patterns)
    let address: string | null = null;
    const addressMatch = snippetText.match(
      /(?:Dirección|Dirección:|Address:?|📍)?\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+\s+\d+[^,.\n]*(?:,\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+)?)/
    );
    if (addressMatch) {
      address = addressMatch[1].trim();
    }

    listings.push({
      name,
      phone,
      address,
      website_url,
      profile_url: profileUrl,
      description: snippetText || null,
    });

    console.log(
      `[PáginasAmarillas] ✓ ${name} | tel: ${phone ?? "none"} | web: ${website_url ?? "none"}`
    );
  }

  // Fallback: if block pattern found nothing, try extracting any PA business URLs
  if (listings.length === 0) {
    console.log(
      "[PáginasAmarillas] Block pattern found nothing, trying fallback extraction"
    );
    const hrefPattern =
      /href="([^"]*paginasamarillas\.com\.uy\/[^"]+)"[^>]*>([^<]{3,80})</gi;
    let m: RegExpExecArray | null;
    while ((m = hrefPattern.exec(html)) !== null) {
      let url = m[1];
      const uddgM = url.match(/uddg=(https?[^&"]+)/i);
      if (uddgM) {
        try { url = decodeURIComponent(uddgM[1]); } catch { url = uddgM[1]; }
      }
      if (!url.includes("paginasamarillas.com.uy")) continue;
      const key = url.toLowerCase().replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);

      const name = stripHtml(m[2])
        .replace(/[|\-–]\s*(Páginas Amarillas)[^]*/gi, "")
        .trim();
      if (!name || name.length < 2) continue;

      listings.push({
        name,
        phone: null,
        address: null,
        website_url: null,
        profile_url: url,
        description: null,
      });
      console.log(`[PáginasAmarillas] ✓ (fallback) ${name}`);
    }
  }

  return listings;
}

export async function scrapePaginasAmarillas(
  keyword: string,
  location: string,
  maxPages = 3
): Promise<ScrapedBusiness[]> {
  console.log(
    `[PáginasAmarillas] Starting search: "${keyword}" in "${location}"`
  );

  // Build DDG queries targeting paginasamarillas.com.uy
  const queries = [
    `site:paginasamarillas.com.uy ${keyword} ${location}`,
    `site:paginasamarillas.com.uy "${keyword}" Uruguay`,
    `${keyword} ${location} paginasamarillas.com.uy`,
  ];

  const seen = new Set<string>();
  const allListings: PAListing[] = [];

  for (let qi = 0; qi < queries.length; qi++) {
    const query = queries[qi];
    console.log(
      `[PáginasAmarillas] DDG query (${qi + 1}/${queries.length}): ${query}`
    );

    const pagesForQuery = qi === 0 ? Math.min(maxPages, 3) : 1;

    for (let page = 0; page < pagesForQuery; page++) {
      const results = await ddgFetchPAPage(query, seen, page);
      allListings.push(...results);

      if (results.length === 0) break;

      if (page < pagesForQuery - 1) {
        await new Promise((r) =>
          setTimeout(r, 1000 + Math.random() * 1000)
        );
      }
    }

    if (qi < queries.length - 1) {
      await new Promise((r) =>
        setTimeout(r, 1000 + Math.random() * 1000)
      );
    }
  }

  console.log(
    `[PáginasAmarillas] Done — ${allListings.length} listings found`
  );

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
