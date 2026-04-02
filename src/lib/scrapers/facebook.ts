import type { ScrapedBusiness } from "../types";

// ─── Facebook Pages scraper via DDG ──────────────────────────────────────────
// Facebook requires login to browse pages, so we use DuckDuckGo to surface
// Facebook Pages and extract business info from titles/snippets.

const DDG_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-UY,es;q=0.9,en;q=0.8",
};

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
  // Exclude non-business URLs
  const excluded = [
    "/groups/", "/events/", "/marketplace/", "/photos/", "/videos/",
    "/posts/", "profile.php", "/people/", "login", "signup", "help",
    "about", "policies", "/watch", "/gaming",
  ];
  return !excluded.some((e) => lower.includes(e));
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

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

function cleanFbTitle(title: string): string {
  return title
    .replace(/\s*[|\-–]\s*Facebook\s*$/gi, "")
    .replace(/\s*-\s*Facebook\s*$/gi, "")
    .replace(/\s*\|\s*Facebook\s*$/gi, "")
    .replace(/\s+\|\s+/g, " | ")
    .trim();
}

// ─── DDG fetch ────────────────────────────────────────────────────────────────

interface FbPage {
  username: string;
  name: string;
  bio: string;
  profile_url: string;
}

async function ddgFetchFbPage(
  query: string,
  seen: Set<string>,
  page: number
): Promise<FbPage[]> {
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
      console.error(`[Facebook] DDG p${page + 1} returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    console.log(`[Facebook] DDG p${page + 1} HTML length: ${html.length}`);

    return parseFbPagesFromDDG(html, seen);
  } catch (err) {
    console.error(
      `[Facebook] DDG p${page + 1} failed:`,
      (err as Error).message
    );
    return [];
  }
}

function parseFbPagesFromDDG(html: string, seen: Set<string>): FbPage[] {
  const pages: FbPage[] = [];

  // Match result blocks containing facebook.com URLs
  const resultBlockPattern =
    /class="result__a"[^>]*href="([^"]*facebook\.com[^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = resultBlockPattern.exec(html)) !== null) {
    const rawHref = match[1];
    const titleHtml = match[2];
    const snippetHtml = match[3];

    // Decode DDG redirect URL
    let realHref = rawHref;
    const uddgMatch = rawHref.match(/uddg=(https?[^&"]+)/i);
    if (uddgMatch) {
      try {
        realHref = decodeURIComponent(uddgMatch[1]);
      } catch {
        realHref = uddgMatch[1];
      }
    }

    if (!realHref.toLowerCase().includes("facebook.com")) continue;
    if (!isBusinessPage(realHref)) continue;

    const username = extractFbUsername(realHref);
    if (!username) continue;

    const userKey = username.toLowerCase();
    if (seen.has(userKey)) continue;
    seen.add(userKey);

    const titleText = stripHtml(titleHtml);
    const snippetText = stripHtml(snippetHtml);

    const name = cleanFbTitle(titleText) || username;

    // Build canonical profile URL
    const profile_url = `https://www.facebook.com/${username}`;

    pages.push({ username, name, bio: snippetText, profile_url });
    console.log(`[Facebook] ✓ ${name} (${username})`);
  }

  // Fallback: extract any Facebook page URLs from hrefs
  if (pages.length === 0) {
    console.log("[Facebook] Block pattern found nothing, trying fallback");
    const hrefPattern =
      /href="([^"]*facebook\.com\/[^"]+)"[^>]*>([^<]{3,80})</gi;
    let m: RegExpExecArray | null;
    while ((m = hrefPattern.exec(html)) !== null) {
      let url = m[1];
      const uddgM = url.match(/uddg=(https?[^&"]+)/i);
      if (uddgM) {
        try { url = decodeURIComponent(uddgM[1]); } catch { url = uddgM[1]; }
      }

      if (!url.toLowerCase().includes("facebook.com")) continue;
      if (!isBusinessPage(url)) continue;

      const username = extractFbUsername(url);
      if (!username) continue;

      const key = username.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const name = cleanFbTitle(stripHtml(m[2])) || username;
      const profile_url = `https://www.facebook.com/${username}`;

      pages.push({ username, name, bio: "", profile_url });
      console.log(`[Facebook] ✓ (fallback) ${name} (${username})`);
    }
  }

  return pages;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function scrapeFacebook(
  keyword: string,
  location: string,
  queryCount = 2
): Promise<ScrapedBusiness[]> {
  console.log(`[Facebook] Starting search: "${keyword}" in "${location}"`);

  const allQueries: string[] = [
    `${keyword} ${location} facebook`,
    `site:facebook.com "${keyword}" "${location}"`,
    `${keyword} facebook ${location} negocio`,
    `site:facebook.com/pages ${keyword} ${location}`,
  ];

  const queries = allQueries.slice(0, Math.max(1, queryCount));
  const seen = new Set<string>();
  const allPages: FbPage[] = [];

  for (let qi = 0; qi < queries.length; qi++) {
    const query = queries[qi];
    console.log(`[Facebook] DDG query (${qi + 1}/${queries.length}): ${query}`);

    // Fetch up to 2 pages for the first query
    const maxPages = qi === 0 ? 2 : 1;

    for (let page = 0; page < maxPages; page++) {
      const results = await ddgFetchFbPage(query, seen, page);
      allPages.push(...results);

      if (results.length === 0) break;

      if (page < maxPages - 1) {
        await new Promise((r) =>
          setTimeout(r, 1800 + Math.random() * 1400)
        );
      }
    }

    if (qi < queries.length - 1) {
      await new Promise((r) =>
        setTimeout(r, 1000 + Math.random() * 1000)
      );
    }
  }

  console.log(`[Facebook] Done — ${allPages.length} pages found`);

  return allPages.map((p) => ({
    name: p.name,
    platform: "facebook" as const,
    profile_url: p.profile_url,
    location,
    category: keyword,
    description: p.bio || undefined,
  }));
}
