export type Platform = "google_maps" | "instagram";

// ─── Enrichment ───────────────────────────────────────────────────────────────
export interface EnrichmentData {
  activity_level: "active" | "low_activity" | "unknown";
  digital_maturity: "none" | "basic" | "established";
  business_size: "small" | "medium" | "unknown";
  sells_online: boolean | null;
  social_quality: "strong" | "moderate" | "weak" | "none";
}

// ─── Opportunities ────────────────────────────────────────────────────────────
export interface DetectedOpportunity {
  code: string;
  label: string;
  description: string;
  impact: "high" | "medium" | "low";
}

// ─── Campaign ─────────────────────────────────────────────────────────────────
export interface Campaign {
  id: number;
  name: string;
  description: string | null;
  status: "active" | "paused" | "archived";
  notes: string | null;
  lead_count?: number;
  created_at: string;
  updated_at: string;
}

// ─── Scraping Job ─────────────────────────────────────────────────────────────
export interface ScrapeJob {
  id: number;
  name: string;
  keyword: string;
  locations: string; // JSON string[]
  platforms: string; // JSON string[]
  max_scrolls: number;
  schedule: string; // "manual" | "daily" | "weekly"
  enabled: number; // 0 | 1
  last_run_at: string | null;
  next_run_at: string | null;
  leads_found_last: number | null;
  created_at: string;
}

export type SearchDepth = "quick" | "standard" | "deep";

export interface SearchConfig {
  keyword: string;
  locations: string[];
  platforms: Platform[];
  maxLeads?: number;   // max leads to save per location
  maxScrolls?: number; // legacy: controls Google Maps depth directly
}

export type LeadStatus = "not_contacted" | "contacted" | "interested" | "proposal_sent" | "closed_won" | "closed_lost";

export type WebsiteQuality = "good" | "needs_improvement" | "poor";

export type WebsiteFilter = "all" | "no_website" | "poor" | "needs_improvement" | "good";

export type LeadPriority = "high" | "medium" | "low";

export type PriorityFilter = "all" | "high" | "medium" | "low";

export interface WebsiteAnalysis {
  quality: WebsiteQuality;
  score: number;
  issues: string[];
  summary: string;
  cms_type: string | null;
}

export interface Lead {
  id: number;
  name: string;
  platform: Platform;
  profile_url: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  description: string | null;
  has_website: boolean;
  website_url: string | null;
  website_quality: WebsiteQuality | null;
  website_quality_score: number | null;
  website_quality_issues: string | null; // JSON array string
  website_quality_summary: string | null;
  category: string | null;
  enrichment_data: string | null; // JSON EnrichmentData
  opportunities: string | null; // JSON DetectedOpportunity[]
  opportunity_summary: string | null;
  tags: string | null; // JSON string[]
  lead_score: number | null;
  lead_priority: LeadPriority | null;
  lead_score_breakdown: string | null; // JSON array of ScoreBreakdown
  // ── Ceibo Sales Intelligence ──────────────────────────────────────────────
  contact_reason: string | null;   // why this lead is relevant (sales-focused)
  business_diagnosis: string | null; // short diagnosis of their digital situation
  estimated_value: "low" | "medium" | "high" | null; // potential contract value
  // ── AI Features (OpenAI) ──────────────────────────────────────────────────
  ai_summary: string | null;       // AI-generated commercial summary (2-4 lines)
  ai_analysis: string | null;      // JSON AiLeadAnalysis (weaknesses, opportunities, etc.)
  ai_premium_tier: "$" | "$$" | "$$$" | null; // AI-estimated client value tier
  ai_analyzed_at: string | null;   // ISO timestamp of last AI analysis (for caching)
  // ── Workflow ───────────────────────────────────────────────────────────────
  is_favorite: boolean;            // starred/shortlisted by user
  is_hot: boolean;                 // flagged as hot lead (high priority + actionable)
  // ── v0.9.0 — Intelligence ──────────────────────────────────────────────────
  difficulty_level: "easy" | "medium" | "hard" | null;
  segment_tags: string | null;     // JSON SegmentTag[]
  location_city: string | null;
  location_region: string | null;
  location_country: string | null;
  // ── v1.1.0 — Scraper enrichment ───────────────────────────────────────────
  rating: number | null;
  review_count: number | null;
  cms_type: string | null;
  // ─────────────────────────────────────────────────────────────────────────
  status: LeadStatus;
  sequence_stage: string | null; // none | first_contact | followup_1 | followup_2 | done
  last_contacted_at: string | null;
  next_followup_at: string | null;
  notes: string | null;
  keyword: string;
  search_location: string;
  created_at: string;
  updated_at: string;
}

export interface SearchParams {
  keyword: string;
  location: string;
  platforms: Platform[];
}

export interface ContactLog {
  id: number;
  lead_id: number;
  channel: "whatsapp" | "email";
  message_preview: string | null;
  created_at: string;
}

export interface LeadEvent {
  id: number;
  lead_id: number;
  event_type: string;
  description: string;
  created_at: string;
}

export interface ScrapedBusiness {
  name: string;
  platform: Platform;
  profile_url: string;
  phone?: string;
  email?: string;
  location?: string;
  description?: string;
  category?: string;
  website_url?: string;
  rating?: number;
  review_count?: number;
}
