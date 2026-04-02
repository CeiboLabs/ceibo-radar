/**
 * Bing search helper — used by scrapers that need better indexing than DDG.
 * Bing has direct URLs in hrefs (no redirect layer) and indexes Facebook/local
 * directories much better than DuckDuckGo.
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

const BING_UA = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

export async function bingSearch(
  query: string,
  count = 30
): Promise<BingResult[]> {
  const ua = BING_UA[Math.floor(Math.random() * BING_UA.length)];
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${count}&mkt=es-UY&setlang=es&cc=UY`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-UY,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[Bing] ${res.status} for query: ${query}`);
      return [];
    }

    const html = await res.text();
    console.log(`[Bing] HTML length: ${html.length} for: ${query}`);
    console.log(`[Bing] HTML snippet: ${html.slice(0, 500).replace(/\s+/g, " ")}`);

    return parseBingResults(html);
  } catch (err) {
    console.error(`[Bing] fetch failed:`, (err as Error).message);
    return [];
  }
}

function parseBingResults(html: string): BingResult[] {
  const results: BingResult[] = [];

  // Strategy 1: match <li class="b_algo"> blocks
  // Each block has: <h2><a href="URL">Title</a></h2> + snippet <p>
  const blockPattern = /<li[^>]+class="b_algo"[^>]*>([\s\S]*?)(?=<li[^>]+class="b_algo"|<\/ol>)/gi;
  let block: RegExpExecArray | null;

  while ((block = blockPattern.exec(html)) !== null) {
    const blockHtml = block[1];

    // Extract URL + title from <h2><a href="...">
    const linkMatch = blockHtml.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const url = linkMatch[1];
    const title = stripHtml(linkMatch[2]);

    // Extract snippet: look for <p ...> inside b_caption or b_snippet
    const snippetMatch = blockHtml.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
      ?? blockHtml.match(/<p[^>]*>([\s\S]{20,400}?)<\/p>/i);
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : "";

    if (title && url) {
      results.push({ title, url, snippet });
    }
  }

  // Strategy 2: fallback — extract all h2>a links that look like real results
  if (results.length === 0) {
    console.log("[Bing] Block strategy found nothing, using h2>a fallback");
    const linkPattern = /<h2[^>]*>\s*<a[^>]+href="(https?:\/\/(?!www\.bing\.com)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkPattern.exec(html)) !== null) {
      const url = m[1];
      const title = stripHtml(m[2]);
      if (title && url && title.length > 3) {
        results.push({ title, url, snippet: "" });
      }
    }
  }

  return results;
}
