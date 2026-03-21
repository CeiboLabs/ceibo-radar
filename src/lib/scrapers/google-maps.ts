import { chromium } from "playwright";
import type { ScrapedBusiness } from "../types";

export async function scrapeGoogleMaps(
  keyword: string,
  location: string,
  maxScrolls = 8
): Promise<ScrapedBusiness[]> {
  const results: ScrapedBusiness[] = [];
  let browser;

  // Approximate max listings based on scroll depth
  const maxListings = Math.min(Math.ceil(maxScrolls * 3), 60);

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      locale: "es-UY",
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: { "Accept-Language": "es-UY,es;q=0.9" },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const page = await context.newPage();

    const searchQuery = `${keyword} ${location}`;
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

    console.log(`[Google Maps] Searching: "${searchQuery}" (maxScrolls=${maxScrolls})`);

    await page.goto(mapsUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    await page.waitForSelector('[role="feed"]', { timeout: 15000 }).catch(() => {
      console.log("[Google Maps] Feed not found, continuing...");
    });

    await page.waitForTimeout(2500);

    // Scroll to load more results
    const feed = await page.$('[role="feed"]');
    if (feed) {
      for (let i = 0; i < maxScrolls; i++) {
        await feed.evaluate((el) => el.scrollBy(0, 700));
        await page.waitForTimeout(700);

        // Stop early if we've hit the end-of-results marker
        const endMsg = await page.$("text=You've reached the end of the list");
        if (endMsg) {
          console.log(`[Google Maps] Reached end of results after ${i + 1} scrolls`);
          break;
        }
      }
    }

    // Extract listing links from the sidebar
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

    // Visit each listing detail page
    for (const link of listingLinks.slice(0, maxListings)) {
      try {
        await page.goto(link, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForSelector("h1", { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(800);

        const business = await page.evaluate((url) => {
          const name = document.querySelector("h1")?.textContent?.trim() ?? null;

          // Website: Google Maps uses data-item-id="authority"
          const websiteEl = document.querySelector(
            'a[data-item-id="authority"]'
          ) as HTMLAnchorElement | null;
          const websiteUrl = websiteEl?.href ?? null;

          // Phone: multiple selectors for different locales/layouts
          const phoneSelectors = [
            '[data-tooltip="Copy phone number"]',
            '[data-tooltip="Copiar número de teléfono"]',
            '[aria-label*="Phone"]',
            '[aria-label*="Teléfono"]',
            'button[data-item-id*="phone"] .Io6YTe',
            '[data-item-id^="phone:"] .Io6YTe',
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

          // Address
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

          // Category — shown below the business name in Google Maps
          const categorySelectors = [
            ".DkEaL",
            '[jsaction*="pane.rating.category"]',
            'button[jsaction*="category"]',
            ".YhemCb",   // alternate Maps class
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

          return { name, profile_url: url, website_url: websiteUrl, phone, location: address, category };
        }, link);

        if (business.name) {
          results.push({
            name: business.name,
            platform: "google_maps",
            profile_url: business.profile_url,
            phone: business.phone ?? undefined,
            location: business.location ?? undefined,
            category: business.category ?? undefined,
            website_url: business.website_url ?? undefined,
          });
          console.log(
            `[Google Maps] ✓ ${business.name} | cat: ${business.category ?? "-"} | web: ${business.website_url ?? "none"}`
          );
        }
      } catch (err) {
        console.error(`[Google Maps] Error visiting listing:`, (err as Error).message);
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
