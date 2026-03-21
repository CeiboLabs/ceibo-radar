# Ceibo Radar

**Internal sales intelligence platform for Ceibo Labs.**

Ceibo Radar is a tool built to find, analyze and prioritize potential clients for Ceibo Labs — a software and web development studio based in Uruguay. It automates the prospecting process so the team can focus on closing deals, not hunting for leads.

---

## What it does

Ceibo Radar scans Google Maps and Instagram to find local businesses, then runs each one through a multi-layer analysis pipeline:

- **Presence detection** — does the business have a website? Is it reachable?
- **Website quality analysis** — is the site modern, mobile-friendly, secure, and functional?
- **Ceibo Fit Score** — a 0–100 score that rates how good a lead is for Ceibo Labs, with labels: 🔥 Perfect Fit / 👍 Good Fit / ❌ Low Fit
- **Contact reason** — a clear, sales-focused sentence explaining why this business needs us
- **Business diagnosis** — a short summary of what the business is likely losing due to weak digital presence
- **Estimated client value** — $ / $$ / $$$ based on business type, size and digital needs
- **Opportunity detection** — specific gaps: no website, no SSL, not mobile-friendly, no contact path, etc.
- **Auto-tagging** — structured tags generated from data (sin-website, instagram-activo, alta-prioridad, etc.)
- **Business enrichment** — inferred attributes: activity level, digital maturity, business size, social quality

---

## Core views

| View | Purpose |
|---|---|
| **🔥 Oportunidades** | Top opportunities ranked by score — best leads of the day |
| **Leads** | Full database with filters, search, and contact tracking |
| **Campañas** | Organize leads into sales campaigns |
| **Dashboard** | Metrics: funnel, priorities, platforms, niches, locations |
| **Jobs** | Configure and run recurring scraping jobs |

---

## Tech stack

- **Next.js 15** (App Router) — frontend + API routes
- **SQLite** via `better-sqlite3` — local database, zero config
- **Playwright** — headless browser for Google Maps scraping
- **Tailwind CSS v3** — dark UI with Ceibo green palette
- **Anthropic SDK** — AI message generation for outreach

---

## Running locally

```bash
npm install
npm run dev
```

Database is created automatically at `data/leads.db` on first run.

Requires Node 18+ and Chromium (installed automatically via `playwright install chromium`).

---

## Architecture

```
src/
├── app/
│   ├── api/           # All API routes (search, leads, campaigns, jobs, metrics, opportunities)
│   ├── opportunities/ # Top opportunities dashboard
│   ├── campaigns/     # Campaign management
│   ├── dashboard/     # Metrics and analytics
│   └── jobs/          # Scraping job scheduler
├── components/        # Shared UI components (LeadsTable, LeadModal, LeadFilters, AppNav...)
└── lib/
    ├── scrapers/       # Google Maps + Instagram scrapers, website checker, quality analyzer
    ├── lead-score.ts   # Ceibo Fit scoring engine (configurable weights)
    ├── enrichment.ts   # Business attribute inference
    ├── opportunities.ts # Commercial opportunity detection
    ├── contact-reason.ts # Sales contact reason generator
    ├── diagnosis.ts    # Business digital diagnosis
    ├── value-estimator.ts # Estimated contract value
    ├── auto-tagger.ts  # Deterministic tag generation
    └── db.ts           # SQLite singleton + schema + migrations
```

All scoring and analysis is deterministic — based on real scraped data, no fabrication.

---

## Ceibo Labs

[ceibo.dev](https://ceibo.dev) · Montevideo, Uruguay
