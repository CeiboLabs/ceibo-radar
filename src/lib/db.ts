import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "leads.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema(db);
    runMigrations(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      profile_url TEXT NOT NULL UNIQUE,
      phone TEXT,
      email TEXT,
      location TEXT,
      description TEXT,
      has_website INTEGER NOT NULL DEFAULT 0,
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
      status TEXT NOT NULL DEFAULT 'not_contacted',
      sequence_stage TEXT NOT NULL DEFAULT 'none',
      last_contacted_at TEXT,
      next_followup_at TEXT,
      notes TEXT,
      keyword TEXT NOT NULL,
      search_location TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_platform ON leads(platform);
    CREATE INDEX IF NOT EXISTS idx_leads_has_website ON leads(has_website);
    CREATE INDEX IF NOT EXISTS idx_leads_website_quality ON leads(website_quality);
    CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score DESC);
    CREATE INDEX IF NOT EXISTS idx_leads_lead_priority ON leads(lead_priority);

    CREATE TABLE IF NOT EXISTS contact_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      channel TEXT NOT NULL,
      message_preview TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contact_log_lead_id ON contact_log(lead_id);

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaign_leads (
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (campaign_id, lead_id)
    );

    CREATE TABLE IF NOT EXISTS scraping_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      keyword TEXT NOT NULL,
      locations TEXT NOT NULL DEFAULT '[]',
      platforms TEXT NOT NULL DEFAULT '["google_maps"]',
      max_scrolls INTEGER NOT NULL DEFAULT 8,
      schedule TEXT NOT NULL DEFAULT 'manual',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      next_run_at TEXT,
      leads_found_last INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS job_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES scraping_jobs(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      leads_found INTEGER DEFAULT 0,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead ON campaign_leads(lead_id);
    CREATE INDEX IF NOT EXISTS idx_job_runs_job ON job_runs(job_id);

    CREATE TABLE IF NOT EXISTS ai_cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lead_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON lead_events(lead_id);
  `);
}

// Non-destructive migrations for existing DBs that lack the new columns
function runMigrations(db: Database.Database) {
  const cols = db
    .prepare("PRAGMA table_info(leads)")
    .all() as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));

  const toAdd: [string, string][] = [
    ["website_quality", "TEXT"],
    ["website_quality_score", "INTEGER"],
    ["website_quality_issues", "TEXT"],
    ["website_quality_summary", "TEXT"],
    ["category", "TEXT"],
    ["enrichment_data", "TEXT"],
    ["opportunities", "TEXT"],
    ["opportunity_summary", "TEXT"],
    ["tags", "TEXT"],
    ["lead_score", "INTEGER"],
    ["lead_priority", "TEXT"],
    ["lead_score_breakdown", "TEXT"],
    ["sequence_stage", "TEXT"],
    ["last_contacted_at", "TEXT"],
    ["next_followup_at", "TEXT"],
    // v0.5.0 — Ceibo Sales Intelligence
    ["contact_reason", "TEXT"],
    ["business_diagnosis", "TEXT"],
    ["estimated_value", "TEXT"],
    // v0.6.0 — AI Features (OpenAI)
    ["ai_summary", "TEXT"],
    ["ai_analysis", "TEXT"],
    ["ai_premium_tier", "TEXT"],
    ["ai_analyzed_at", "TEXT"],
    // v0.7.0 — Workflow
    ["is_favorite", "INTEGER NOT NULL DEFAULT 0"],
    // v0.8.0 — Sales Execution
    ["is_hot", "INTEGER NOT NULL DEFAULT 0"],
  ];

  for (const [col, type] of toAdd) {
    if (!colNames.has(col)) {
      db.exec(`ALTER TABLE leads ADD COLUMN ${col} ${type}`);
    }
  }
}
