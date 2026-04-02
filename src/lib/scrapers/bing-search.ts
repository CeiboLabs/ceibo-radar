/**
 * Bing search helper — used by scrapers that need better indexing than DDG.
 * Bing indexes Facebook/local directories much better than DuckDuckGo.
 *
 * NOTE: From server environments Bing wraps outbound links in redirect URLs
 * like /ck/a?!&&p=...&u=BASE64_URL&ntb=1 — we decode these automatically.
 */

export interface BingResult {
  title: string;
  url: string;
  snippet: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

/** Resolve a Bing /ck/a redirect to the real URL, or return as-is. */
function resolveBingRedirect(href: string): string {
  // Relative: /ck/a?!&&p=...&u=BASE64_URL&ntb=1
  const uMatch = href.match(/[?&]u=([A-Za-z0-9_-]+)/);
  if (uMatch) {
    try {
      // Bing uses base64url without padding
      const padded = uMatch[1].replace(/-/g, "+").replace(/_/g, "/");
      const decoded = atob(padded + "==".slice((padded.length % 4) || 4));
      if (decoded.startsWith("http")) return decoded;
    } catch {
      // ignore decode errors
    }
  }
  return href;
}

/** Normalise href → absolute https URL or null */
function resolveHref(href: string): string | null {
  if (!href) return null;
  const resolved = href.startsWith("/") ? `https://www.bing.com${href}` : href;
  const real = resolveBingRedirect(resolved);
  if (!real.startsWith("http")) return null;
  return real;
}

const BING_UA = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

export async function bingSearch(
  query: string,
  count = 30
): Promise<BingResult[]> {
  const ua = BING_UA[Math.floor(Math.random() * BING_UA.length)];
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${count}&mkt=es-UY&setlang=es&cc=UY&FORM=HDRSC2`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-UY,es;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[Bing] ${res.status} for query: ${query}`);
      return [];
    }

    const html = await res.text();
    console.log(`[Bing] HTML length: ${html.length} for: ${query}`);

    const results = parseBingResults(html);
    console.log(`[Bing] Parsed ${results.length} results`);
    if (results.length === 0) {
      // Log enough to diagnose
      console.log(`[Bing] snippet: ${html.slice(0, 800).replace(/\s+/g, " ")}`);
    }
    return results;
  } catch (err) {
    console.error(`[Bing] fetch failed:`, (err as Error).message);
    return [];
  }
}

function parseBingResults(html: string): BingResult[] {
  const results: BingResult[] = [];

  // Strategy 1: match <li class="b_algo"> blocks
  const blockPattern = /<li[^>]+class="b_algo"[^>]*>([\s\S]*?)(?=<li[^>]+class="b_algo"|<\/ol>)/gi;
  let block: RegExpExecArray | null;

  while ((block = blockPattern.exec(html)) !== null) {
    const blockHtml = block[1];

    // h2>a — href may be a /ck/a redirect or a direct https URL
    const linkMatch = blockHtml.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const url = resolveHref(linkMatch[1]);
    if (!url || url.includes("bing.com/search") || url.includes("bing.com/images")) continue;

    const title = stripHtml(linkMatch[2]);

    const snippetMatch =
      blockHtml.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ??
      blockHtml.match(/<p[^>]*>([\s\S]{20,400}?)<\/p>/i);
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : "";

    if (title && url) {
      results.push({ title, url, snippet });
    }
  }

  if (results.length > 0) return results;

  // Strategy 2: any h2>a link (with redirect resolution)
  console.log("[Bing] Block strategy found nothing, trying h2>a fallback");
  const linkPattern = /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(html)) !== null) {
    const url = resolveHref(m[1]);
    if (!url || url.includes("bing.com/search")) continue;
    const title = stripHtml(m[2]);
    if (title && title.length > 3) {
      results.push({ title, url, snippet: "" });
    }
  }

  if (results.length > 0) return results;

  // Strategy 3: <cite> tags contain the displayed URL — extract domain from those
  // and match with nearby <a> hrefs
  console.log("[Bing] h2>a fallback found nothing, trying cite-based extraction");
  const citePattern = /<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<cite[^>]*>([^<]+)<\/cite>/gi;
  while ((m = citePattern.exec(html)) !== null) {
    const url = resolveHref(m[1]);
    if (!url || url.includes("bing.com/search")) continue;
    const displayedUrl = m[2].trim();
    if (displayedUrl.includes("bing.com") || displayedUrl.length < 5) continue;
    results.push({ title: displayedUrl, url, snippet: "" });
  }

  return results;
}
