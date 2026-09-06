# Deriv Intelligence

AI-powered global intelligence / social listening platform that monitors public perception of **Deriv**: sentiment by country, hour, aspect, topic, journey funnel, crisis alerts, automated weekly reports, and an "Ask your market" analytics chat.

Built for an internal pitch to Deriv. All Phase 1 data sources are free.

## Stack

- **pnpm monorepo** — full Node.js + TypeScript (no Python)
- **PostgreSQL + pgvector** (FTS + semantic search), **Redis + BullMQ** (pipeline & cron)
- **Provider-agnostic LLM** (OpenAI-compatible SDK, base URL + model via `.env`)
- **Next.js 14 + Tailwind + Recharts + react-simple-maps** for the dashboard

## Structure

```
apps/
  web/          dashboard + API routes (Next.js)
  worker/       pipeline worker (BullMQ) + cron + backfill CLI
packages/
  core/         schema, migrations, normalizer, enrichment, aggregation, search, anomaly, report, chat
  connectors/   reddit, youtube, google play, tavily
  llm/          tiered OpenAI-compatible client (cheap/strong) + cost tracking
```

## Setup

```bash
pnpm install
pnpm docker:up        # postgres(+pgvector) + redis
pnpm migrate          # core schema
pnpm seed             # (optional) 60-day synthetic demo data — dashboard comes alive instantly
pnpm dev:web          # dashboard at http://localhost:3000
pnpm dev:worker       # pipeline worker + cron
```

Copy `.env.example` to `.env` and fill in the API keys you need.

## Pipeline

`fetch (cron per source) → normalize+dedupe (ingest) → enrich (tiered LLM: language → sentiment/aspect → topic → journey_stage) → location estimate (heuristics: exact gplay country, language, subreddit/domain) → embedding (pgvector) → SQL aggregation`

Anomaly detection (z-score on volume & sentiment per country/topic) → alert + severity + timeline + Telegram. Weekly PDF report every Monday 06:00.

## Data sources (Phase 1 — all free)

| Source | Method | Notes |
|---|---|---|
| Reddit | OAuth app-only (100 QPM) | link+comment search, incremental cursor |
| YouTube | Data API v3 (10k units/day) | search (100 units) + commentThreads (1 unit), quota tracking |
| Google Play | scraper per country+language | **strongest location signal** (exact country), rating, app version |
| Web | Tavily (1000 credits/month) | topic=news, days param |

X API & TikTok Research API: Phase 3 backlog (cost/approval).

## Phases

- **Phase 1 (done)** — ingestion, tiered enrichment, hybrid search, journey funnel, crisis alerts, weekly PDF report, ask-your-market chat, cost dashboard
- **Phase 2 (done)** — competitor benchmark (`/competitors`: share of voice, aspect matrix, switcher detection), KOL radar (`/kol`), Google Play per-version pain points (`/versions`)
- **Phase 3 partial (free sources)** — response copilot + ticket escalation (`/search` → "Draft reply"), timeline replay map (`/replay`), correlation insights (`/insights`), auto-FAQ (`/faq`). X API / TikTok remain blocked on budget/approval.

## Key commands

```bash
pnpm fetch reddit                 # one-shot fetch for a single source
pnpm backfill --source reddit --days 30
pnpm backfill --source youtube --days 30
pnpm report                       # generate the weekly report now
pnpm --filter @deriv-intel/worker dev   # worker + cron
pnpm eval                         # golden dataset eval (sentiment/aspect/topic accuracy)
pnpm seed                         # synthetic demo data (no API key needed)
```

## Quality & cost

- **Golden dataset**: `packages/core/src/eval/golden.jsonl` (manually labeled, covers ID/EN slang) — run `pnpm eval` whenever prompts or models change
- **Cost observability**: every LLM request is recorded in the `llm_usage` table and shown on the dashboard at `/costs`
- **Dedupe & anti-bot**: content hash + spam heuristics before analytics
- **Tiered LLM**: cheap model for ~95% of classifications, strong model for reasoning/anomaly explanation/reports/chat

## Roadmap

See `C:\Users\62838\.local\share\kilo\plans\1788606327987-deriv-intelligence-pitch-roadmap.md` for the full Phase 1–3 roadmap (competitor benchmark, KOL radar, response copilot, etc.).
