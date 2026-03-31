-- ============================================================
-- Ceibo Radar — Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── Leads ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  profile_url TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  location TEXT,
  description TEXT,
  has_website BOOLEAN NOT NULL DEFAULT FALSE,
  website_url TEXT,
  website_quality TEXT,
  website_quality_score INTEGER,
  website_quality_issues TEXT,
  website_quality_summary TEXT,
  category TEXT,
  enrichment_data TEXT,
  opportunities TEXT,
  opportunity_summary TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  lead_score INTEGER,
  lead_priority TEXT,
  lead_score_breakdown TEXT,
  contact_reason TEXT,
  business_diagnosis TEXT,
  estimated_value TEXT,
  ai_summary TEXT,
  ai_analysis TEXT,
  ai_premium_tier TEXT,
  ai_analyzed_at TIMESTAMPTZ,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  is_hot BOOLEAN NOT NULL DEFAULT FALSE,
  difficulty_level TEXT,
  segment_tags TEXT,
  location_city TEXT,
  location_region TEXT,
  location_country TEXT,
  rating REAL,
  review_count INTEGER,
  cms_type TEXT,
  status TEXT NOT NULL DEFAULT 'not_contacted',
  sequence_stage TEXT NOT NULL DEFAULT 'none',
  last_contacted_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  notes TEXT,
  keyword TEXT NOT NULL,
  search_location TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_platform ON leads(platform);
CREATE INDEX IF NOT EXISTS idx_leads_has_website ON leads(has_website);
CREATE INDEX IF NOT EXISTS idx_leads_website_quality ON leads(website_quality);
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_leads_lead_priority ON leads(lead_priority);
CREATE INDEX IF NOT EXISTS idx_leads_location_region ON leads(location_region);
CREATE INDEX IF NOT EXISTS idx_leads_search_location ON leads(search_location);
CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- ─── Contact Log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_log (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_log_lead_id ON contact_log(lead_id);

-- ─── Campaigns ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_leads (
  campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead ON campaign_leads(lead_id);

-- ─── Scraping Jobs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scraping_jobs (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  keyword TEXT NOT NULL,
  locations TEXT NOT NULL DEFAULT '[]',
  platforms TEXT NOT NULL DEFAULT '["google_maps"]',
  max_scrolls INTEGER NOT NULL DEFAULT 8,
  schedule TEXT NOT NULL DEFAULT 'manual',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  leads_found_last INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_runs (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES scraping_jobs(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  leads_found INTEGER DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job ON job_runs(job_id);

-- ─── AI Cache ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Lead Events ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_events (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON lead_events(lead_id);

-- ─── Auto-update updated_at trigger ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_leads_updated_at ON leads;
CREATE TRIGGER trigger_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_campaigns_updated_at ON campaigns;
CREATE TRIGGER trigger_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Disable RLS (internal tool, no auth needed) ──────────────────────────────
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE contact_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_events DISABLE ROW LEVEL SECURITY;
