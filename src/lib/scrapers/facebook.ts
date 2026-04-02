import type { ScrapedBusiness } from "../types";
import { bingSearch } from "./bing-search";

// ─── Facebook Pages scraper via Bing ──────────────────────────────────────────
// Facebook requires login to browse pages. Bing indexes FB pages much better
// than DuckDuckGo, so we use Bing to surface Facebook Pages and extract
// business info from titles/snippets.

// ─── URL helpers ──────────────────────────────────────────────────────────────

const FB_RESERVED = new Set([
  "groups", "events", "marketplace", "watch", "gaming", "pages", "profile",
  "people", "login", "help", "about", "policies", "stories", "reels",
  "photos", "videos", "posts", "pg", "permalink", "signup", "directory",
  "hashtag", "sharer", "dialog", "recover", "settings", "privacy",
]);

function extractFbUsername(href: string): string | null {
  // /pages/NAME/ID → use NAME
  const pagesMatch = href.match(/facebook\.com\/pages\/([^/?#]+)/i);
  if (pagesMatch) return pagesMatch[1];

  // /pg/NAME → use NAME
  const pgMatch = href.match(/facebook\.com\/pg\/([^/?#]+)/i);
  if (pgMatch) return pgMatch[1];

  // facebook.com/NAME → use NAME (if not a reserved path)
  const directMatch = href.match(
    /facebook\.com\/([a-zA-Z0-9._-]{3,50})(?:\/|$|\?)/i
  );
  if (directMatch) {
    const name = directMatch[1];
    if (!FB_RESERVED.has(name.toLowerCase())) return name;
  }

  return null;
}

function isBusinessPage(href: string): boolean {
  const lower = href.toLowerCase();
  const excluded = [
    "/groups/", "/events/", "/marketplace/", "/photos/", "/videos/",
    "/posts/", "profile.php", "/people/", "login", "signup", "help",
    "about", "policies", "/watch", "/gaming",
  ];
  return !excluded.some((e) => lower.includes(e));
}

function cleanFbTitle(title: string): string {
  return title
    .replace(/\s*[|\-–]\s*Facebook\s*$/gi, "")
    .replace(/\s*-\s*Facebook\s*$/gi, "")
    .replace(/\s*\|\s*Facebook\s*$/gi, "")
    .replace(/\s+\|\s+/g, " | ")
    .trim();
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function scrapeFacebook(
  keyword: string,
  location: string,
  queryCount = 2
): Promise<ScrapedBusiness[]> {
  console.log(`[Facebook] Starting search: "${keyword}" in "${location}"`);

  // NOTE: site: operator returns 0 results from server IPs on Bing.
  // Use plain keyword queries and filter to facebook.com URLs programmatically.
  const allQueries: string[] = [
    `${keyword} ${location} facebook página`,
    `${keyword} ${location} facebook.com negocio`,
    `"${keyword}" "${location}" facebook`,
    `${keyword} Uruguay facebook página negocios`,
  ];

  const queries = allQueries.slice(0, Math.max(1, queryCount));
  const seen = new Set<string>();
  const results: ScrapedBusiness[] = [];

  for (let qi = 0; qi < queries.length; qi++) {
    const query = queries[qi];
    console.log(`[Facebook] Bing query (${qi + 1}/${queries.length}): ${query}`);

    const bingResults = await bingSearch(query, 30);
    console.log(`[Facebook] Bing returned ${bingResults.length} results`);

    for (const r of bingResults) {
      const url = r.url;
      if (!url.toLowerCase().includes("facebook.com")) continue;
      if (!isBusinessPage(url)) continue;

      const username = extractFbUsername(url);
      if (!username) continue;

      const key = username.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const name = cleanFbTitle(r.title) || username;
      const profile_url = `https://www.facebook.com/${username}`;

      console.log(`[Facebook] ✓ ${name} (${username})`);
      results.push({
        name,
        platform: "facebook" as const,
        profile_url,
        location,
        category: keyword,
        description: r.snippet || undefined,
      });
    }

    if (qi < queries.length - 1) {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 800));
    }
  }

  console.log(`[Facebook] Done — ${results.length} pages found`);
  return results;
}
