create extension if not exists vector;

create table if not exists entities (
  id serial primary key,
  name text not null unique,
  is_primary boolean not null default false,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists items (
  id bigserial primary key,
  source text not null,
  source_id text not null,
  url text,
  title text,
  content text not null,
  author text,
  language text,
  published_at timestamptz not null,
  engagement jsonb not null default '{}',
  metadata jsonb not null default '{}',
  content_hash text not null,
  fetched_at timestamptz not null default now(),
  unique (source, source_id)
);

create unique index if not exists items_source_hash_uidx on items (source, content_hash);
create index if not exists items_published_idx on items (published_at desc);
create index if not exists items_source_idx on items (source);
create index if not exists items_fts_idx on items using gin (to_tsvector('simple', coalesce(title, '') || ' ' || content));

create table if not exists item_enrichments (
  item_id bigint primary key references items(id) on delete cascade,
  sentiment text check (sentiment in ('positive', 'negative', 'neutral', 'mixed')),
  sentiment_score numeric,
  sentiment_confidence numeric,
  emotion text,
  intensity numeric,
  aspects jsonb not null default '[]',
  topics text[] not null default '{}',
  journey_stage text check (journey_stage in ('signup', 'kyc', 'deposit', 'trading', 'withdrawal', 'support', 'general', 'other')),
  language text,
  location_country text,
  location_confidence numeric,
  local_hour int,
  is_bot boolean not null default false,
  bot_reason text,
  llm_model text,
  enriched_at timestamptz not null default now()
);

create index if not exists enrich_country_idx on item_enrichments (location_country);
create index if not exists enrich_topics_idx on item_enrichments using gin (topics);
create index if not exists enrich_stage_idx on item_enrichments (journey_stage);
create index if not exists enrich_sentiment_idx on item_enrichments (sentiment);

create table if not exists item_embeddings (
  item_id bigint primary key references items(id) on delete cascade,
  embedding vector(%DIM%)
);

create index if not exists embeddings_hnsw_idx on item_embeddings using hnsw (embedding vector_cosine_ops);

create table if not exists authors (
  id bigserial primary key,
  source text not null,
  source_author_id text not null,
  username text,
  profile jsonb not null default '{}',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (source, source_author_id)
);

create table if not exists alerts (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  metric text not null,
  scope text not null,
  country text,
  topic text,
  window_start timestamptz,
  window_end timestamptz,
  baseline numeric,
  observed numeric,
  z_score numeric,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  confidence numeric,
  explanation text,
  status text not null default 'open',
  timeline jsonb not null default '[]'
);

create index if not exists alerts_created_idx on alerts (created_at desc);
create index if not exists alerts_scope_idx on alerts (scope, status);

create table if not exists reports (
  id bigserial primary key,
  period_start timestamptz not null,
  period_end timestamptz not null,
  summary text,
  sections jsonb not null default '{}',
  file_path text,
  sent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists llm_usage (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  purpose text not null,
  model text not null,
  source text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric
);

create index if not exists llm_usage_created_idx on llm_usage (created_at desc);

create table if not exists query_state (
  source text primary key,
  cursor jsonb not null default '{}',
  metrics jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

insert into entities (name, is_primary, aliases)
values ('Deriv', true, '{Deriv,deriv.app,Binary.com,DBot,DTrader,Deriv Bot,Deriv Go,Deriv Trader,Deriv CTOT}')
on conflict (name) do nothing;
