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
  console.log(`[Instagram] Done — ${profiles.length} profiles`);

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

// ─── Serper-based search ──────────────────────────────────────────────────────

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function searchInstagramProfiles(
  keyword: string,
  location: string,
  queryCount: number
): Promise<InstagramProfile[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.error("[Instagram] SERPER_API_KEY not set — skipping Instagram search");
    return [];
  }

  const kw = keyword.trim();
  const kwNoAccent = removeAccents(kw);
  const loc = location.replace(", Uruguay", "").trim();

  const queries: string[] = [
    `${kw} ${loc} site:instagram.com`,
    `${kwNoAccent} ${loc} site:instagram.com`,
    `"${kw}" "${loc}" instagram`,
  ];

  const uniqueQueries = [...new Set(queries)].slice(0, Math.max(1, queryCount));

  const seen = new Set<string>();
  const excluded = new Set([
    "explore", "accounts", "legal", "about", "help", "privacy",
    "directory", "hashtag", "p", "reel", "tv", "stories", "reels",
  ]);
  const results: InstagramProfile[] = [];

  for (let i = 0; i < uniqueQueries.length; i++) {
    const q = uniqueQueries[i];
    console.log(`[Instagram] Serper query (${i + 1}/${uniqueQueries.length}): ${q}`);

    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q, num: 10, gl: "uy", hl: "es" }),
      });

      if (!res.ok) {
        console.error(`[Instagram] Serper error: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const organicResults: Array<{ link: string; title: string; snippet?: string }> =
        data.organic ?? [];

      for (const item of organicResults) {
        if (!item.link.includes("instagram.com")) continue;

        const username = extractUsername(item.link);
        if (!username) continue;
        const userLower = username.toLowerCase();
        if (excluded.has(userLower) || seen.has(userLower)) continue;
        seen.add(userLower);

        const name = cleanTitle(item.title ?? "", username);
        const bio = item.snippet ?? "";
        const websiteUrl = extractUrlFromText(bio);

        results.push({ username, name, bio, websiteUrl });
        console.log(`[Instagram] ✓ @${username} | ${name}`);
      }
    } catch (err) {
      console.error(`[Instagram] Serper query failed:`, (err as Error).message);
    }

    if (i < uniqueQueries.length - 1) await randomDelay(300, 600);
  }

  return results;
}

function extractUsername(url: string): string | null {
  const m = url.match(/instagram\.com\/([a-zA-Z0-9._]{2,30})\/?/i);
  if (!m) return null;
  return m[1];
}

function cleanTitle(title: string, username: string): string {
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
