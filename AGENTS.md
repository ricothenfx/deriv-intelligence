# AGENTS.md

## Project

Deriv Intelligence — monorepo pnpm, Node.js + TypeScript penuh. Dashboard Next.js (`apps/web`), pipeline worker BullMQ (`apps/worker`), paket inti `packages/core|connectors|llm`.

## Commands

```bash
pnpm install
pnpm docker:up          # postgres+pgvector & redis (docker compose)
pnpm migrate            # jalankan migrasi SQL (packages/core/src/migrations)
pnpm seed               # data demo sintetis 60 hari (tanpa API key)
pnpm dev:web            # Next.js dev server di :3000
pnpm dev:worker         # worker BullMQ + cron
pnpm typecheck          # tsc --noEmit semua paket
pnpm run fetch <source>  # fetch one-shot (reddit|youtube|gplay|tavily); WAJIB `run` — `pnpm fetch` adalah built-in pnpm (no-op)
pnpm backfill --source <source> --days 30
pnpm report             # generate weekly report PDF
pnpm eval               # golden dataset evaluation
```

## Conventions

- Semua konfigurasi via `.env` (lihat `.env.example`). LLM via OpenAI-compatible endpoint: `LLM_BASE_URL`, `LLM_MODEL_CHEAP`, `LLM_MODEL_STRONG`, `LLM_EMBEDDING_MODEL`, `EMBEDDING_DIM` (default 1536 — harus konsisten sebelum migrasi pertama).
- Workspace package di-import sebagai source TS (`main: src/index.ts`); Next memakai `transpilePackages`, worker memakai `tsx`.
- SQL: migrasi manual di `packages/core/src/migrations/NNN_*.sql`, diaplikasikan oleh runner di `packages/core/src/migrate.ts` (urutan nama file, tabel `schema_migrations`).
- Analytics: query SQL parameterized di `packages/core/src/analytics.ts`; API routes di `apps/web/src/app/api/*/route.ts` memanggil core langsung.
- Bahasa komunikasi dengan user: Bahasa Indonesia.

## Gotchas

- `vector(%DIM%)` di migrasi diganti nilai `EMBEDDING_DIM` saat migrasi berjalan.
- Embedding gagal (mis. API key kosong) tidak menggagalkan enrichment — hanya semantic search yang nonaktif.
- Worker `fetch` cron: reddit */15m, youtube hourly (quota-aware), gplay hourly, tavily 6h; anomaly hourly; report Senin 06:00.
- google-play-scraper: `country` lowercase ISO2; metadata `country` (uppercase) dipakai location intelligence dengan confidence 0.95.
