import type { ScrapedBusiness } from "../types";

function randomDelay(min: number, max: number): Promise<void> {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

interface InstagramProfile {
  username: string;
  name: string;
  bio: string;
  websiteUrl: string | null;
}

export async function scrapeInstagram(
  keyword: string,
  location: string,
  queryCount = 1
): Promise<ScrapedBusiness[]> {
  const profiles = await searchInstagramProfiles(keyword, location, queryCount);
  console.log(`[Instagram] Done — ${profiles.length} profiles from DDG`);

  return profiles.map((p) => ({
    name: p.name || p.username,
    platform: "instagram" as const,
    profile_url: `https://www.instagram.com/${p.username}/`,
    location,
    category: keyword,
    description: p.bio || undefined,
    website_url: p.websiteUrl ?? undefined,
  }));
}

// ─── DDG-based profile extraction ────────────────────────────────────────────

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function searchInstagramProfiles(
  keyword: string,
  location: string,
  queryCount: number
): Promise<InstagramProfile[]> {
  const kw = keyword.trim();
  const kwNoAccent = removeAccents(kw);

  // Build a diverse set of queries — both broad and specific
  const allQueries: string[] = [
    `${kw} ${location} instagram`,
    `${kwNoAccent} ${location} instagram`,
    `site:instagram.com ${kw} ${location}`,
    `"${kw}" "${location}" site:instagram.com`,
    `${kw} instagram ${location} negocio`,
    `${kwNoAccent} site:instagram.com ${location}`,
  ];

  // Deduplicate (e.g. if keyword has no accents, first two would be identical)
  const uniqueQueries = [...new Set(allQueries)].slice(0, Math.max(2, queryCount + 1));

  const seen = new Set<string>();
  const results: InstagramProfile[] = [];
  const excluded = new Set([
    "explore", "accounts", "legal", "about", "help", "privacy",
    "directory", "hashtag", "p", "reel", "tv", "stories", "reels",
  ]);

  for (let i = 0; i < uniqueQueries.length; i++) {
    const query = uniqueQueries[i];
    console.log(`[Instagram] DDG query (${i + 1}/${uniqueQueries.length}): ${query}`);

    // For the first two queries, also fetch page 2
    const maxPages = i < 2 ? 2 : 1;
    const profiles = await ddgSearchProfiles(query, excluded, seen, maxPages);
    for (const p of profiles) results.push(p);

    if (i < uniqueQueries.length - 1) {
      await randomDelay(1500, 2800);
    }
  }

  return results;
}

async function ddgSearchProfiles(
  query: string,
  excluded: Set<string>,
  seen: Set<string>,
  maxPages = 1
): Promise<InstagramProfile[]> {
  const profiles: InstagramProfile[] = [];

  for (let page = 0; page < maxPages; page++) {
    const pageProfiles = await ddgFetchPage(query, excluded, seen, page);
    profiles.push(...pageProfiles);

    if (pageProfiles.length === 0) break; // No more results on this page
    if (page < maxPages - 1) await randomDelay(1800, 3200);
  }

  return profiles;
}

async function ddgFetchPage(
  query: string,
  excluded: Set<string>,
  seen: Set<string>,
  page: number
): Promise<InstagramProfile[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const DDG_HEADERS = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-UY,es;q=0.9,en;q=0.8",
    };

    let res: Response;

    if (page === 0) {
      // Primera página: GET
      const url = `https://html.duckduckgo.com/html/?${new URLSearchParams({ q: query }).toString()}`;
      res = await fetch(url, { method: "GET", signal: controller.signal, headers: DDG_HEADERS });
    } else {
      // Páginas siguientes: POST con offset (s=11 para página 2, s=21 para página 3, etc.)
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
      console.error(`[Instagram] DDG p${page + 1} returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    console.log(`[Instagram] DDG p${page + 1} HTML length: ${html.length}`);

    return parseProfilesFromDDG(html, excluded, seen);
  } catch (err) {
    console.error(`[Instagram] DDG p${page + 1} failed:`, (err as Error).message);
    return [];
  }
}

/**
 * Extracts Instagram profiles from DuckDuckGo HTML search results.
 *
 * DDG HTML result structure (simplified):
 *   <a class="result__a" href="...instagram.com/username/...">Name • Instagram</a>
 *   <a class="result__snippet" ...>bio text...</a>
 */
function parseProfilesFromDDG(
  html: string,
  excluded: Set<string>,
  seen: Set<string>
): InstagramProfile[] {
  const profiles: InstagramProfile[] = [];

  // Split by result blocks — each result contains a title link + snippet
  // We look for pairs of (result__a href containing instagram.com) + (result__snippet)
  const resultBlockPattern =
    /class="result__a"[^>]*href="([^"]*instagram\.com[^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = resultBlockPattern.exec(html)) !== null) {
    const rawHref = match[1];
    const titleHtml = match[2];
    const snippetHtml = match[3];

    // Extract username from href (direct or DDG redirect)
    const username = extractUsername(rawHref);
    if (!username) continue;
    const userLower = username.toLowerCase();
    if (excluded.has(userLower) || seen.has(userLower)) continue;
    seen.add(userLower);

    // Clean title → extract name (e.g. "Peluquería Sol (@peluso) • Instagram photos and videos")
    const titleText = stripHtml(titleHtml);
    const name = cleanTitle(titleText, username);

    // Clean snippet → bio text
    const bio = stripHtml(snippetHtml).trim();

    // Try to extract a website URL from the bio
    const websiteUrl = extractUrlFromText(bio);

    profiles.push({ username, name, bio, websiteUrl });
    console.log(`[Instagram] ✓ @${username} | ${name} | web: ${websiteUrl ?? "none"}`);
  }

  // Fallback: if block pattern matched nothing, try just extracting usernames from any href
  if (profiles.length === 0) {
    console.log("[Instagram] Block pattern found nothing, falling back to href-only extraction");
    const usernamesOnly = extractUsernamesFromHtml(html, excluded, seen);
    for (const username of usernamesOnly) {
      profiles.push({ username, name: username, bio: "", websiteUrl: null });
      console.log(`[Instagram] ✓ @${username} (href-only)`);
    }
  }

  return profiles;
}

function extractUsername(href: string): string | null {
  // DDG redirect: uddg=https%3A%2F%2Fwww.instagram.com%2Fusername
  const uddgMatch = href.match(/uddg=https?(?:%3A|:)(?:%2F%2F|\/\/)(?:www\.)?instagram\.com(?:%2F|\/)([a-zA-Z0-9._]{2,30})/i);
  if (uddgMatch) return uddgMatch[1];

  // Direct: https://www.instagram.com/username
  const directMatch = href.match(/instagram\.com\/([a-zA-Z0-9._]{2,30})/i);
  if (directMatch) return directMatch[1];

  return null;
}

function extractUsernamesFromHtml(html: string, excluded: Set<string>, seen: Set<string>): string[] {
  const usernames: string[] = [];
  const patterns = [
    /href=["']https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]{2,30})\/?["']/g,
    /uddg=(https?(?:%3A|:)(?:%2F%2F|\/\/)(?:www\.)?instagram\.com(?:%2F|\/)([a-zA-Z0-9._]{2,30}))/gi,
    /instagram\.com\/([a-zA-Z0-9._]{2,30})(?:\/|["'\s<]|$)/g,
  ];

  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) {
      const u = (m[2] ?? m[1]).toLowerCase();
      if (!excluded.has(u) && !seen.has(u)) {
        seen.add(u);
        usernames.push(m[2] ?? m[1]);
      }
    }
  }
  return usernames;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

function cleanTitle(title: string, username: string): string {
  // Remove "• Instagram photos and videos" and similar suffixes
  return title
    .replace(/[•·|].*?(instagram|photos|videos).*/gi, "")
    .replace(new RegExp(`\\(@?${username}\\)`, "i"), "")
    .replace(/\(@[^)]+\)/, "")
    .trim() || username;
}

function extractUrlFromText(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s\n\r,;'"<>()[\]{}|\\^`]+/gi;
  const matches = text.match(urlRegex);
  if (!matches) return null;

  const socialDomains = [
    "instagram.com", "facebook.com", "twitter.com", "tiktok.com",
    "youtube.com", "wa.me", "t.me", "threads.net",
  ];
  return matches.find((url) => !socialDomains.some((d) => url.includes(d))) ?? null;
}
