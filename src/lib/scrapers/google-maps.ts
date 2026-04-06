import { chromium, type BrowserContext } from "playwright";
import type { ScrapedBusiness } from "../types";

// ─── Anti-detection helpers ───────────────────────────────────────────────────

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min: number, max: number): Promise<void> {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[\u00ad\u200b-\u200f\ufeff\u00a0]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

// ─── Concurrent listing visits ────────────────────────────────────────────────
const VISIT_CONCURRENCY = 3;

export async function scrapeGoogleMaps(
  keyword: string,
  location: string,
  maxScrolls = 8
): Promise<ScrapedBusiness[]> {
  const results: ScrapedBusiness[] = [];
  let browser;

  // ~3.5 listings per scroll, cap at 60
  const maxListings = Math.min(Math.ceil(maxScrolls * 3.5), 60);

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
    });

    const context = await browser.newContext({
      userAgent: randomUA(),
      locale: "es-UY",
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: { "Accept-Language": "es-UY,es;q=0.9,en;q=0.8" },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, "languages", { get: () => ["es-UY", "es", "en"] });
      // @ts-expect-error
      window.chrome = { runtime: {} };
    });

    // ── Search page ─────────────────────────────────────────────────────────
    const page = await context.newPage();

    const searchQuery = `${keyword} ${location}`;
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

    console.log(`[Google Maps] Searching: "${searchQuery}" (maxScrolls=${maxScrolls})`);

    await page.goto(mapsUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    await page.waitForSelector('[role="feed"]', { timeout: 15000 }).catch(() => {
      console.log("[Google Maps] Feed not found, continuing...");
    });

    await randomDelay(1500, 2800);

    // ── Scroll to load more results ──────────────────────────────────────────
    const feed = await page.$('[role="feed"]');
    if (feed) {
      for (let i = 0; i < maxScrolls; i++) {
        await feed.evaluate((el) => el.scrollBy(0, 800));
        await randomDelay(500, 950);

        const endMsg = await page.$("text=You've reached the end of the list");
        if (endMsg) {
          console.log(`[Google Maps] Reached end after ${i + 1} scrolls`);
          break;
        }
      }
    }

    // ── Collect listing URLs ─────────────────────────────────────────────────
    const listingLinks = await page.$$eval(
      'a[href*="/maps/place/"]',
      (links) =>
        Array.from(
          new Set(
            (links as HTMLAnchorElement[])
              .map((l) => l.href)
              .filter((href) => href.includes("/maps/place/"))
          )
        )
    );

    console.log(
      `[Google Maps] Found ${listingLinks.length} listings (visiting up to ${maxListings})`
    );

    if (listingLinks.length === 0) {
      const title = await page.title();
      console.log(`[Google Maps] Page title: "${title}" — may be blocked or no results`);
    }

    await page.close();

    // ── Visit listings concurrently ──────────────────────────────────────────
    const toVisit = listingLinks.slice(0, maxListings);

    for (let i = 0; i < toVisit.length; i += VISIT_CONCURRENCY) {
      const batch = toVisit.slice(i, i + VISIT_CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map((link) => visitListing(context, link))
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value) {
          results.push(result.value);
          const b = result.value;
          console.log(
            `[Google Maps] ✓ ${b.name} | ★${b.rating ?? "-"} (${b.review_count ?? 0} reseñas) | web: ${b.website_url ?? "none"}`
          );
        }
      }

      // Small delay between batches
      if (i + VISIT_CONCURRENCY < toVisit.length) {
        await randomDelay(300, 700);
      }
    }

    await context.close();
  } catch (err) {
    console.error("[Google Maps] Fatal error:", err);
  } finally {
    if (browser) await browser.close();
  }

  console.log(`[Google Maps] Done — ${results.length} businesses scraped`);
  return results;
}

// ─── Single listing visitor (with 1 auto-retry) ───────────────────────────────

async function visitListing(
  context: BrowserContext,
  link: string,
  attempt = 1
): Promise<ScrapedBusiness | null> {
  const page = await context.newPage();

  try {
    await page.goto(link, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("h1", { timeout: 8000 }).catch(() => {});
    await randomDelay(600, 1200);

    const business = await page.evaluate((url) => {
      const name = document.querySelector("h1")?.textContent?.trim() ?? null;

      // ── Website ────────────────────────────────────────────────────────────
      const websiteSelectors = [
        'a[data-item-id="authority"]',
        'a[data-tooltip="Open website"]',
        'a[data-tooltip="Abrir sitio web"]',
        'a[aria-label*="website" i]',
        'a[aria-label*="sitio web" i]',
        'a[href][data-value="Website"]',
      ];
      let websiteUrl: string | null = null;
      for (const sel of websiteSelectors) {
        const el = document.querySelector(sel) as HTMLAnchorElement | null;
        if (el?.href && !el.href.includes("google.com") && !el.href.includes("maps.google")) {
          websiteUrl = el.href;
          break;
        }
      }

      // ── Phone ──────────────────────────────────────────────────────────────
      const phoneSelectors = [
        '[data-tooltip="Copy phone number"]',
        '[data-tooltip="Copiar número de teléfono"]',
        '[aria-label*="Phone"]',
        '[aria-label*="Teléfono"]',
        'button[data-item-id*="phone"] .Io6YTe',
        '[data-item-id^="phone:"] .Io6YTe',
        '[data-item-id*="phone"]',
      ];
      let phone: string | null = null;
      for (const sel of phoneSelectors) {
        const el = document.querySelector(sel);
        const text = el?.textContent?.trim();
        if (text && /[\d\s()+\-]{6,}/.test(text)) {
          phone = text;
          break;
        }
      }

      // ── Address ────────────────────────────────────────────────────────────
      const addressSelectors = [
        '[data-item-id="address"]',
        'button[data-item-id*="address"] .Io6YTe',
        '[aria-label*="Address"]',
        '[aria-label*="Dirección"]',
      ];
      let address: string | null = null;
      for (const sel of addressSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          address = el.textContent.trim();
          break;
        }
      }

      // ── Category ───────────────────────────────────────────────────────────
      const categorySelectors = [
        ".DkEaL",
        '[jsaction*="pane.rating.category"]',
        'button[jsaction*="category"]',
        ".YhemCb",
      ];
      let category: string | null = null;
      for (const sel of categorySelectors) {
        const el = document.querySelector(sel);
        const text = el?.textContent?.trim();
        if (text && text.length < 60) {
          category = text;
          break;
        }
      }

      // ── Rating (★ x.x) ─────────────────────────────────────────────────────
      let rating: number | null = null;
      const ratingSelectors = [
        'span[aria-hidden="true"].MW4etd',
        "span.ceNzKf",
        "div.F7nice span[aria-hidden='true']",
        ".fontDisplayLarge",
      ];
      for (const sel of ratingSelectors) {
        const el = document.querySelector(sel);
        const text = el?.textContent?.trim();
        if (text) {
          const num = parseFloat(text.replace(",", "."));
          if (!isNaN(num) && num > 0 && num <= 5) {
            rating = num;
            break;
          }
        }
      }
      // Fallback: aria-label on the star container
      if (rating === null) {
        const starEl = document.querySelector(
          '[aria-label*="stars"], [aria-label*="estrellas"]'
        );
        if (starEl) {
          const label = starEl.getAttribute("aria-label") ?? "";
          const match = label.match(/^([\d,.]+)/);
          if (match) {
            const num = parseFloat(match[1].replace(",", "."));
            if (!isNaN(num) && num > 0 && num <= 5) rating = num;
          }
        }
      }

      // ── Review count ───────────────────────────────────────────────────────
      let reviewCount: number | null = null;
      const reviewSelectors = [
        "span.UY7F9",
        'button[jsaction*="reviewChart"] span',
        ".fontBodySmall span",
      ];
      for (const sel of reviewSelectors) {
        const el = document.querySelector(sel);
        const text = el?.textContent?.trim();
        if (text) {
          const num = parseInt(text.replace(/\D/g, ""), 10);
          if (!isNaN(num) && num > 0) {
            reviewCount = num;
            break;
          }
        }
      }
      // Fallback: aria-label "1,234 reviews" / "1.234 reseñas"
      if (reviewCount === null) {
        const reviewEl = document.querySelector(
          '[aria-label*="reviews"], [aria-label*="reseñas"]'
        );
        if (reviewEl) {
          const label = reviewEl.getAttribute("aria-label") ?? "";
          const match = label.match(/([\d.,]+)\s*(reviews|reseñas)/i);
          if (match) {
            const num = parseInt(match[1].replace(/[.,]/g, ""), 10);
            if (!isNaN(num) && num > 0) reviewCount = num;
          }
        }
      }

      // ── Email (mailto: links inside the listing panel) ─────────────────────
      let email: string | null = null;
      const mailtoEls = document.querySelectorAll('a[href^="mailto:"]');
      if (mailtoEls.length > 0) {
        const href = (mailtoEls[0] as HTMLAnchorElement).href;
        email = href.replace("mailto:", "").split("?")[0].trim() || null;
      }

      return {
        name,
        profile_url: url,
        website_url: websiteUrl,
        phone,
        email,
        location: address,
        category,
        rating,
        review_count: reviewCount,
      };
    }, link);

    if (!business.name) return null;

    return {
      name: business.name,
      platform: "google_maps",
      profile_url: business.profile_url,
      phone: normalizePhone(business.phone) ?? undefined,
      email: business.email ?? undefined,
      location: business.location ?? undefined,
      category: business.category ?? undefined,
      website_url: business.website_url ?? undefined,
      rating: business.rating ?? undefined,
      review_count: business.review_count ?? undefined,
    };
  } catch (err) {
    if (attempt < 2) {
      await page.close().catch(() => {});
      await randomDelay(800, 1600);
      return visitListing(context, link, attempt + 1);
    }
    console.error(
      `[Google Maps] Error visiting listing (attempt ${attempt}):`,
      (err as Error).message
    );
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}
