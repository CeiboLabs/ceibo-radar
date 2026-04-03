import { classifyPhone } from "../phone-classifier";

export interface ExtractedContacts {
  phone?: string;
  email?: string;
}

const PHONE_PATTERNS = [
  // Uruguay mobile: 09x xxx xxx (with various separators)
  /\b0?9[1-9][\s\-.]?\d{3}[\s\-.]?\d{3}\b/g,
  // Uruguay landline: 2xxx xxxx, 3x xxxx xxxx, etc.
  /\b(?:\+598[\s\-.]?)?[234678]\d[\s\-.]?\d{3}[\s\-.]?\d{3,4}\b/g,
  // International: +598 followed by number
  /\+598[\s\-.]?\d{2}[\s\-.]?\d{3}[\s\-.]?\d{3}\b/g,
];

const EMAIL_PATTERN = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;

const WHATSAPP_PATTERN = /(?:wa\.me|whatsapp\.com\/send\?phone=)[\/=]?(\d{8,15})/gi;

function cleanPhone(raw: string): string {
  // Keep leading 0 — phone-classifier needs "09XXXXXXX" to recognize Uruguay mobile
  return raw.replace(/[\s\-.()]/g, "");
}

function validateAndNormalizePhone(raw: string): string | null {
  const classification = classifyPhone(raw);
  if (classification.type === "unknown") return null;
  // For mobile with a WhatsApp URL, extract the E.164 number
  if (classification.whatsappUrl) {
    const m = classification.whatsappUrl.match(/wa\.me\/(\d+)/);
    if (m) return "+" + m[1];
  }
  return cleanPhone(raw);
}

export function extractContactsFromHtml(
  html: string,
  existing?: { phone?: string | null; email?: string | null }
): ExtractedContacts {
  const result: ExtractedContacts = {};

  // Skip if already have both contacts
  if (existing?.phone && existing?.email) return result;

  // Strip script/style tags before parsing
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  // Extract email
  if (!existing?.email) {
    const emailMatches = stripped.match(EMAIL_PATTERN) ?? [];
    const validEmail = emailMatches.find(e =>
      !e.includes("example") &&
      !e.includes("test@") &&
      !e.includes("noreply") &&
      !e.includes("@sentry")
    );
    if (validEmail) result.email = validEmail.toLowerCase();
  }

  // Extract WhatsApp (priority over generic phone)
  if (!existing?.phone) {
    WHATSAPP_PATTERN.lastIndex = 0;
    const waMatch = WHATSAPP_PATTERN.exec(stripped);
    if (waMatch) {
      const normalized = validateAndNormalizePhone(waMatch[1]);
      if (normalized) {
        result.phone = normalized;
        return result; // WhatsApp found, use it
      }
    }
  }

  // Extract generic phone
  if (!existing?.phone) {
    for (const pattern of PHONE_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = stripped.match(pattern) ?? [];
      for (const match of matches) {
        const normalized = validateAndNormalizePhone(match);
        if (normalized) {
          result.phone = normalized;
          break;
        }
      }
      if (result.phone) break;
    }
  }

  return result;
}

export function extractContactsFromText(
  text: string,
  existing?: { phone?: string | null; email?: string | null }
): ExtractedContacts {
  return extractContactsFromHtml(text, existing);
}
