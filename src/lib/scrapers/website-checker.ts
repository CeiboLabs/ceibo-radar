export async function checkWebsite(url: string): Promise<boolean> {
  if (!url) return false;

  // Normalize URL
  let normalized = url.trim();
  if (!normalized.startsWith("http")) {
    normalized = "https://" + normalized;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(normalized, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);
    return response.ok || response.status === 405 || response.status === 403; // 403/405 = server exists but restricts method
  } catch {
    // Try GET as fallback
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(normalized, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);
      return response.ok || response.status === 403;
    } catch {
      return false;
    }
  }
}

export function extractWebsiteFromText(text: string): string | undefined {
  const urlRegex = /https?:\/\/[^\s\n\r,;'"<>()[\]{}|\\^`]+/gi;
  const matches = text.match(urlRegex);
  if (!matches) return undefined;

  // Filter out social media URLs (Instagram, Facebook, etc.)
  const socialDomains = ["instagram.com", "facebook.com", "twitter.com", "tiktok.com", "youtube.com", "google.com", "wa.me", "t.me", "linktr.ee"];

  const website = matches.find(url => !socialDomains.some(domain => url.includes(domain)));
  return website;
}
