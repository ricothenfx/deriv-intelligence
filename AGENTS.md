# AGENTS.md

## Project

Deriv Intelligence — pnpm monorepo, full Node.js + TypeScript. Next.js dashboard (`apps/web`), BullMQ pipeline worker (`apps/worker`), core packages `packages/core|connectors|llm`.

## Commands

```bash
pnpm install
pnpm docker:up          # postgres+pgvector & redis (docker compose)
pnpm migrate            # run SQL migrations (packages/core/src/migrations)
pnpm seed               # 60-day synthetic demo data (no API key needed)
pnpm dev:web            # Next.js dev server on :3000
pnpm dev:worker         # BullMQ worker + cron
pnpm typecheck          # tsc --noEmit across all packages
pnpm run fetch <source>  # one-shot fetch (reddit|youtube|gplay|tavily); MUST use `run` — `pnpm fetch` is a pnpm built-in (no-op)
pnpm backfill --source <source> --days 30
pnpm report             # generate weekly report PDF
pnpm eval               # golden dataset evaluation
```

## Conventions

- All configuration via `.env` (see `.env.example`). LLM via an OpenAI-compatible endpoint: `LLM_BASE_URL`, `LLM_MODEL_CHEAP`, `LLM_MODEL_STRONG`, `LLM_EMBEDDING_MODEL`, `EMBEDDING_DIM` (default 1536 — must be consistent before the first migration).
- Workspace packages are imported as TS source (`main: src/index.ts`); Next uses `transpilePackages`, the worker uses `tsx`.
- SQL: manual migrations in `packages/core/src/migrations/NNN_*.sql`, applied by the runner in `packages/core/src/migrate.ts` (filename order, `schema_migrations` table).
- Analytics: parameterized SQL queries in `packages/core/src/analytics.ts`; API routes in `apps/web/src/app/api/*/route.ts` call core directly.
- User communication language: Bahasa Indonesia.

## Gotchas

- `vector(%DIM%)` in migrations is replaced with the `EMBEDDING_DIM` value when the migration runs.
- Embedding failure (e.g. empty API key) does not fail enrichment — only semantic search is disabled.
- Worker `fetch` cron: reddit */15m, youtube hourly (quota-aware), gplay hourly, tavily 6h; anomaly hourly; report Monday 06:00.
- google-play-scraper: `country` is lowercase ISO2; the `country` metadata (uppercase) is used by location intelligence with confidence 0.95.
