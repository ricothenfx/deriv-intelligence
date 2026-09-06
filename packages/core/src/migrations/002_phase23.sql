-- Phase 2/3: brand tracking, escalation tickets, auto-FAQ

alter table item_enrichments add column if not exists mentions_brand boolean;
alter table item_enrichments add column if not exists brands text[] not null default '{}';
create index if not exists enrich_brands_idx on item_enrichments using gin (brands);

-- legacy rows came from Deriv-only queries
update item_enrichments
set mentions_brand = true, brands = '{deriv}'
where mentions_brand is null;

insert into entities (name, is_primary, aliases) values
  ('Exness', false, '{Exness,exness.com,Exness Trade}'),
  ('IQ Option', false, '{IQ Option,iqoption.com,IQOption,IQ trading}'),
  ('OctaFX', false, '{OctaFX,octafx.com,Octa}')
on conflict (name) do nothing;

create table if not exists tickets (
  id bigserial primary key,
  item_id bigint references items(id) on delete cascade,
  draft text,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists tickets_created_idx on tickets (created_at desc);

create table if not exists faqs (
  id bigserial primary key,
  question text not null,
  answer text not null,
  language text,
  sources bigint[] not null default '{}',
  created_at timestamptz not null default now()
);
