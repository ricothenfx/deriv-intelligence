-- Phase 3: user-manageable search keywords per channel + cached AI translations

create table if not exists search_keywords (
  id bigserial primary key,
  source text not null,
  query text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (source, query)
);

create index if not exists search_keywords_source_idx on search_keywords (source);

create table if not exists item_translations (
  item_id bigint primary key references items (id) on delete cascade,
  text text not null,
  language text,
  llm_model text,
  created_at timestamptz not null default now()
);
