import type { Lead } from "@/lib/types";

export interface GeneratedMessages {
  instagram: string;
  whatsapp: string;
  email: {
    subject: string;
    body: string;
  };
  mode: "ai" | "template"; // so the UI can show which engine was used
}

// Subset of Lead fields the generator actually needs
export interface LeadContext {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  search_location: string;
  platform: Lead["platform"];
  has_website: boolean;
  website_url: string | null;
  website_quality: Lead["website_quality"];
  phone: string | null;
  email: string | null;
  keyword: string;
}

export function buildLeadContext(lead: Lead): LeadContext {
  return {
    id: lead.id,
    name: lead.name,
    description: lead.description,
    location: lead.location,
    search_location: lead.search_location,
    platform: lead.platform,
    has_website: lead.has_website,
    website_url: lead.website_url,
    website_quality: lead.website_quality,
    phone: lead.phone,
    email: lead.email,
    keyword: lead.keyword,
  };
}
