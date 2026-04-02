import { chromium } from "playwright";
import type { ScrapedBusiness } from "../types";

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min: number, max: number): Promise<void> {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

export async function scrapeInstagram(
  keyword: string,
  location: string,
  queryCount = 1
): Promise<ScrapedBusiness[]> {
  const results: ScrapedBusiness[] = [];

  // Step 1: Find Instagram usernames via DuckDuckGo Lite (multiple query variants)
  const usernames = await searchInstagramUsernames(keyword, location, queryCount);
  console.log(`[Instagram] Found ${usernames.length} usernames across ${queryCount} queries`);

  if (usernames.length === 0) return results;

  // Step 2: Fetch each profile with Playwright
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const context = await browser.newContext({
      userAgent: randomUA(),
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: { "Accept-Language": "es,en;q=0.9" },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    // Visit up to 15 profiles (more in deep mode via larger usernames list)
    const maxProfiles = Math.min(usernames.length, 5 + queryCount * 5);

    for (const username of usernames.slice(0, maxProfiles)) {
      try {
        const page = await context.newPage();
        let profileData: { name: string; bio: string; websiteUrl: string | null } | null = null;

        try {
          const resp = await page.goto(`https://www.instagram.com/${username}/`, {
            waitUntil: "domcontentloaded",
            timeout: 15000,
          });

          await randomDelay(600, 1200);

          if (resp?.ok()) {
            const content = await page.content();

            // Instagram login wall — no profile data available
            if (content.includes("Log in to Instagram") || content.includes("Iniciar sesión en Instagram")) {
              console.warn(`[Instagram] Login wall hit for @${username}, skipping`);
              continue;
            }

            // Try structured data first (most reliable)
            const ldJsonMatch = content.match(
              /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
            );
            let ldData: Record<string, unknown> | null = null;
            if (ldJsonMatch) {
              try {
                ldData = JSON.parse(ldJsonMatch[1]);
              } catch {}
            }

            const metaTitle = content.match(
              /<meta property="og:title" content="([^"]+)"/
            )?.[1];
            const metaDesc = content.match(
              /<meta property="og:description" content="([^"]+)"/
            )?.[1];

            const name =
              (ldData?.name as string) ??
              metaTitle?.split("•")[0].replace(/\(@[^)]+\)/, "").trim() ??
              username;

            const bio =
              (ldData?.description as string) ??
              metaDesc?.replace(/^\d[\d,.k]* followers.*?- /i, "").trim() ??
              "";

            const websiteUrl = extractUrlFromText(bio);
            profileData = { name, bio, websiteUrl };
          }
        } finally {
          await page.close();
        }

        if (profileData) {
          results.push({
            name: profileData.name || username,
            platform: "instagram",
            profile_url: `https://www.instagram.com/${username}/`,
            location,
            category: keyword, // infer category from search keyword
            description: profileData.bio || undefined,
            website_url: profileData.websiteUrl ?? undefined,
          });
          console.log(
            `[Instagram] ✓ ${profileData.name} | web: ${profileData.websiteUrl ?? "none"}`
          );
        }
      } catch (err) {
        console.error(`[Instagram] Error fetching @${username}:`, (err as Error).message);
      }
    }

    await context.close();
  } catch (err) {
    console.error("[Instagram] Fatal error:", err);
  } finally {
    if (browser) await browser.close();
  }

  console.log(`[Instagram] Done — ${results.length} profiles scraped`);
  return results;
}

// ─── Username discovery ───────────────────────────────────────────────────────

/**
 * Searches DuckDuckGo Lite with multiple query variants to find Instagram usernames.
 * More queries = more coverage. Each query may return different profiles.
 */
async function searchInstagramUsernames(
  keyword: string,
  location: string,
  queryCount: number
): Promise<string[]> {
  // Generate query variants — different phrasings find different profiles
  const queries = [
    `site:instagram.com "${keyword}" "${location}"`,
    `site:instagram.com ${keyword} ${location}`,
    `"${keyword}" "${location}" site:instagram.com`,
    `site:instagram.com "${keyword}" ${location} negocio`,
  ].slice(0, Math.max(1, queryCount));

  const allUsernames = new Set<string>();
  const excluded = new Set([
    "explore", "accounts", "legal", "about", "help", "privacy",
    "directory", "hashtag", "p", "reel", "tv", "stories", "reels",
  ]);

  for (const query of queries) {
    console.log(`[Instagram] DDG Lite query: ${query}`);
    const usernames = await ddgSearch(query, excluded);
    usernames.forEach((u) => allUsernames.add(u));

    // Random delay between queries to be respectful
    if (queries.indexOf(query) < queries.length - 1) {
      await randomDelay(1200, 2500);
    }
  }

  return Array.from(allUsernames);
}

async function ddgSearch(query: string, excluded: Set<string>): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es,en;q=0.9",
      },
      body: new URLSearchParams({ q: query }).toString(),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[Instagram] DDG returned ${res.status}`);
      return [];
    }

    const html = await res.text();

    const usernames: string[] = [];
    const seen = new Set<string>();

    // Pattern 1: direct href (https://www.instagram.com/username/)
    const directPattern =
      /href=["']https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]{2,30})\/?["']/g;

    // Pattern 2: DDG redirect URL (?uddg=https%3A%2F%2F...instagram.com%2Fusername)
    const ddgRedirectPattern =
      /uddg=(https?(?:%3A|:)(?:%2F%2F|\/\/)(?:www\.)?instagram\.com(?:%2F|\/)([a-zA-Z0-9._]{2,30}))/gi;

    // Pattern 3: plain text mentions instagram.com/username
    const textPattern =
      /instagram\.com\/([a-zA-Z0-9._]{2,30})(?:\/|["'\s<]|$)/g;

    const addUsername = (username: string) => {
      const u = username.toLowerCase();
      if (!excluded.has(u) && !seen.has(u)) {
        seen.add(u);
        usernames.push(username);
      }
    };

    let match: RegExpExecArray | null;
    while ((match = directPattern.exec(html)) !== null) addUsername(match[1]);
    while ((match = ddgRedirectPattern.exec(html)) !== null) addUsername(match[2]);
    while ((match = textPattern.exec(html)) !== null) addUsername(match[1]);

    console.log(`[Instagram] DDG raw HTML length: ${html.length}, usernames found: ${usernames.length}`);
    return usernames;
  } catch (err) {
    console.error("[Instagram] DDG search failed:", (err as Error).message);
    return [];
  }
}

function extractUrlFromText(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s\n\r,;'"<>()[\]{}|\\^`]+/gi;
  const matches = text.match(urlRegex);
  if (!matches) return null;

  const socialDomains = [
    "instagram.com",
    "facebook.com",
    "twitter.com",
    "tiktok.com",
    "youtube.com",
    "wa.me",
    "t.me",
    "threads.net",
  ];
  return matches.find((url) => !socialDomains.some((d) => url.includes(d))) ?? null;
}
