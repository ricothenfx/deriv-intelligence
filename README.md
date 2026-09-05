# Deriv Intelligence

AI-powered global intelligence / social listening platform untuk memantau persepsi publik tentang **Deriv**: sentimen per negara, jam, aspek, topik, journey funnel, crisis alert, laporan mingguan otomatis, dan chat analitis "Ask your market".

Dibangun untuk pitch internal ke Deriv. Semua sumber data Fase 1 gratis.

## Stack

- **Monorepo pnpm** — Node.js + TypeScript penuh (tanpa Python)
- **PostgreSQL + pgvector** (FTS + semantic search), **Redis + BullMQ** (pipeline & cron)
- **LLM provider-agnostic** (OpenAI-compatible SDK, base URL + model via `.env`)
- **Next.js 14 + Tailwind + Recharts + react-simple-maps** untuk dashboard

## Struktur

```
apps/
  web/          dashboard + API routes (Next.js)
  worker/       pipeline worker (BullMQ) + cron + backfill CLI
packages/
  core/         schema, migrasi, normalizer, enrichment, agregasi, search, anomaly, report, chat
  connectors/   reddit, youtube, google play, tavily
  llm/          client OpenAI-compatible bertingkat (cheap/strong) + cost tracking
```

## Setup

```bash
pnpm install
pnpm docker:up        # postgres(+pgvector) + redis
pnpm migrate          # schema inti
pnpm seed             # (opsional) data demo sintetis 60 hari — dashboard langsung hidup
pnpm dev:web          # dashboard http://localhost:3000
pnpm dev:worker       # pipeline worker + cron
```

Copy `.env.example` ke `.env` dan isi API key sesuai kebutuhan.

## Pipeline

`fetch (cron per sumber) → normalize+dedupe (ingest) → enrich (LLM bertingkat: language → sentiment/aspect → topic → journey_stage) → location estimate (heuristik: gplay country eksak, bahasa, subreddit/domain) → embedding (pgvector) → agregasi SQL`

Anomaly detection (z-score volume & sentimen per negara/topik) → alert + severity + timeline + Telegram. Laporan mingguan PDF Senin 06:00.

## Data sources (Fase 1 — semua gratis)

| Sumber | Cara | Catatan |
|---|---|---|
| Reddit | OAuth app-only (100 QPM) | search link+comment, incremental cursor |
| YouTube | Data API v3 (10k unit/hari) | search (100 unit) + commentThreads (1 unit), quota tracking |
| Google Play | scraper per negara | **sinyal lokasi paling kuat** (country eksak), rating, versi app |
| Web | Tavily (1000 credit/bulan) | topic=news, days param |

X API & TikTok Research API: backlog Fase 3 (biaya/approval).

## Perintah penting

```bash
pnpm fetch reddit                 # one-shot fetch satu sumber
pnpm backfill --source reddit --days 30
pnpm backfill --source youtube --days 30
pnpm report                       # generate laporan mingguan sekarang
pnpm --filter @deriv-intel/worker dev   # worker + cron
pnpm eval                         # golden dataset eval (akurasi sentimen/aspek/topik)
pnpm seed                         # data demo sintetis (tanpa API key)
```

## Kualitas & biaya

- **Golden dataset**: `packages/core/src/eval/golden.jsonl` (label manual, mencakup slang ID/EN) — jalankan `pnpm eval` tiap ganti prompt/model
- **Cost observability**: semua request LLM dicatat di tabel `llm_usage`, tampil di dashboard `/costs`
- **Dedupe & anti-bot**: content hash + heuristik spam sebelum analitik
- **LLM bertingkat**: model murah untuk ~95% klasifikasi, model kuat untuk reasoning/anomaly explanation/laporan/chat

## Roadmap

Lihat `C:\Users\62838\.local\share\kilo\plans\1788606327987-deriv-intelligence-pitch-roadmap.md` untuk roadmap lengkap Fase 1–3 (kompetitor benchmark, KOL radar, response copilot, dll).
