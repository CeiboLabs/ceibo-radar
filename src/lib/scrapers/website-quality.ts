import type { WebsiteAnalysis, WebsiteQuality } from "../types";

// ─── CMS Detection ────────────────────────────────────────────────────────────

function detectCms(html: string): string | null {
  if (
    /<meta[^>]+name=["']generator["'][^>]*content=["'][^"']*wordpress/i.test(html) ||
    /\/wp-content\//.test(html) ||
    /\/wp-includes\//.test(html)
  ) return "wordpress";

  if (
    /static\.wixstatic\.com/.test(html) ||
    /_wixCssNamespace/.test(html) ||
    /X-Wix-Application-Instance-Id/.test(html)
  ) return "wix";

  if (
    /static[0-9]?\.squarespace\.com/.test(html) ||
    /squarespace-cdn\.com/.test(html)
  ) return "squarespace";

  if (
    /cdn\.shopify\.com/.test(html) ||
    /myshopify\.com/.test(html)
  ) return "shopify";

  if (
    /tiendanube\.com/.test(html) ||
    /nuvemshop\.com/.test(html)
  ) return "tiendanube";

  if (
    /webflow\.io/.test(html) ||
    /assets\.website-files\.com/.test(html)
  ) return "webflow";

  if (
    /<meta[^>]+name=["']generator["'][^>]*content=["'][^"']*joomla/i.test(html) ||
    /\/components\/com_/.test(html)
  ) return "joomla";

  if (
    /<meta[^>]+name=["']generator["'][^>]*content=["'][^"']*drupal/i.test(html) ||
    /Drupal\.settings/.test(html)
  ) return "drupal";

  return null;
}

interface Check {
  name: string;
  points: number; // negative = deducted if check fails
}

const CHECKS: Check[] = [
  { name: "no_https", points: -25 },
  { name: "no_viewport", points: -20 },
  { name: "no_title", points: -15 },
  { name: "no_meta_description", points: -10 },
  { name: "no_h1", points: -10 },
  { name: "no_navigation", points: -10 },
  { name: "no_contact", points: -10 },
  { name: "page_too_heavy", points: -10 },
  { name: "no_images", points: -5 },
  { name: "no_social_links", points: -5 },
];

const ISSUE_LABELS: Record<string, string> = {
  no_https: "No tiene HTTPS (sin SSL)",
  no_viewport: "No tiene viewport meta — no es mobile-friendly",
  no_title: "Sin título de página",
  no_meta_description: "Sin meta descripción",
  no_h1: "Sin estructura de headings (H1)",
  no_navigation: "Sin navegación clara",
  no_contact: "Sin información de contacto visible",
  page_too_heavy: "Página muy pesada (>500 KB)",
  no_images: "Sin imágenes visibles",
  no_social_links: "Sin links a redes sociales",
};

export async function analyzeWebsite(url: string): Promise<WebsiteAnalysis> {
  let html = "";
  let sizeBytes = 0;
  let isHttps = url.startsWith("https://");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timeout);

    // Update isHttps based on final redirected URL
    if (res.url) {
      isHttps = res.url.startsWith("https://");
    }

    html = await res.text();
    sizeBytes = Buffer.byteLength(html, "utf8");
  } catch {
    // Site unreachable — treat as worst quality
    return {
      quality: "poor",
      score: 0,
      issues: Object.values(ISSUE_LABELS),
      summary: "No se pudo cargar el sitio web.",
      cms_type: null,
    };
  }

  const lower = html.toLowerCase();
  const failedChecks = new Set<string>();

  // --- Run checks ---

  if (!isHttps) {
    failedChecks.add("no_https");
  }

  if (!/<meta[^>]+name=["']viewport["'][^>]*>/i.test(html)) {
    failedChecks.add("no_viewport");
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch || titleMatch[1].trim().length < 3) {
    failedChecks.add("no_title");
  }

  if (!/<meta[^>]+name=["']description["'][^>]*content=["'][^"']{10,}/i.test(html)) {
    failedChecks.add("no_meta_description");
  }

  if (!/<h1[\s>]/i.test(html)) {
    failedChecks.add("no_h1");
  }

  // Navigation: <nav> tag OR a <ul> with 3+ <li> children (common menu pattern)
  const hasNav = /<nav[\s>]/i.test(html);
  const ulLiMatches = html.match(/<ul[^>]*>([\s\S]*?)<\/ul>/gi) ?? [];
  const hasMenuList = ulLiMatches.some((ul) => {
    const liCount = (ul.match(/<li[\s>]/gi) ?? []).length;
    return liCount >= 3;
  });
  if (!hasNav && !hasMenuList) {
    failedChecks.add("no_navigation");
  }

  // Contact indicators: phone patterns, email, "contacto", "whatsapp", <form>
  const hasPhone = /(\+?[\d][\d\s\-().]{6,}\d)/.test(html);
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/.test(html);
  const hasContactWord = /contacto|contact|whatsapp|formulario|enviar mensaj/i.test(lower);
  const hasForm = /<form[\s>]/i.test(html);
  if (!hasPhone && !hasEmail && !hasContactWord && !hasForm) {
    failedChecks.add("no_contact");
  }

  if (sizeBytes > 500_000) {
    failedChecks.add("page_too_heavy");
  }

  const imgCount = (html.match(/<img[\s>]/gi) ?? []).length;
  if (imgCount < 2) {
    failedChecks.add("no_images");
  }

  const socialDomains = ["instagram.com", "facebook.com", "twitter.com", "tiktok.com", "youtube.com", "linkedin.com"];
  const hasSocialLink = socialDomains.some((d) => lower.includes(d));
  if (!hasSocialLink) {
    failedChecks.add("no_social_links");
  }

  // --- Calculate score ---
  let score = 100;
  for (const check of CHECKS) {
    if (failedChecks.has(check.name)) {
      score += check.points; // points are negative
    }
  }
  score = Math.max(0, score);

  // --- Classify ---
  let quality: WebsiteQuality;
  if (score >= 70) {
    quality = "good";
  } else if (score >= 40) {
    quality = "needs_improvement";
  } else {
    quality = "poor";
  }

  const issues = Array.from(failedChecks).map((k) => ISSUE_LABELS[k]);

  const summary = buildSummary(quality, score, failedChecks);
  const cms_type = detectCms(html);

  return { quality, score, issues, summary, cms_type };
}

function buildSummary(
  quality: WebsiteQuality,
  score: number,
  failedChecks: Set<string>
): string {
  if (quality === "good") {
    return `Sitio en buen estado (${score}/100). Cumple los criterios principales de calidad digital.`;
  }

  const topIssues: string[] = [];

  if (failedChecks.has("no_https")) topIssues.push("sin SSL");
  if (failedChecks.has("no_viewport")) topIssues.push("no es mobile-friendly");
  if (failedChecks.has("no_title") || failedChecks.has("no_meta_description"))
    topIssues.push("sin SEO básico");
  if (failedChecks.has("no_contact")) topIssues.push("sin contacto visible");
  if (failedChecks.has("no_navigation")) topIssues.push("navegación débil");
  if (failedChecks.has("page_too_heavy")) topIssues.push("página pesada");

  const issueText = topIssues.slice(0, 3).join(", ");

  if (quality === "needs_improvement") {
    return `Sitio mejorable (${score}/100): ${issueText}. Oportunidad de mejora significativa.`;
  }

  return `Sitio deficiente (${score}/100): ${issueText}. Candidate ideal para rediseño.`;
}
