import { query } from "./db";

export interface Filters {
  country?: string | null;
  source?: string | null;
  sentiment?: string | null;
  topic?: string | null;
  brand?: string | null;
  from?: string | null;
  to?: string | null;
}

export const ENG_WEIGHT = `case i.source
  when 'reddit' then 1 + coalesce((i.engagement->>'score')::numeric, 0) + 2 * coalesce((i.engagement->>'comments')::numeric, 0)
  when 'youtube' then case when i.metadata->>'kind' = 'video'
      then 10 * log(1 + coalesce((i.engagement->>'viewCount')::numeric, 0))
      else 1 + 3 * coalesce((i.engagement->>'likes')::numeric, 0) end
  when 'gplay' then 1 + coalesce((i.engagement->>'thumbsUp')::numeric, 0)
  else 1 end`;

export function buildWhere(f: Filters): { where: string; params: unknown[] } {
  const brand = (f.brand || "deriv").trim().toLowerCase();
  const conds = [
    "e.is_bot = false",
    "e.sentiment is not null",
    brand === "*" ? "e.brands <> '{}'" : "e.brands @> ARRAY[$1]::text[]",
  ];
  const params: unknown[] = brand === "*" ? [] : [brand];
  if (f.from) {
    params.push(f.from);
    conds.push(`i.published_at >= $${params.length}::timestamptz`);
  }
  if (f.to) {
    params.push(f.to);
    conds.push(`i.published_at <= $${params.length}::timestamptz`);
  }
  if (f.country) {
    params.push(f.country);
    conds.push(`e.location_country = $${params.length}`);
  }
  if (f.source) {
    params.push(f.source);
    conds.push(`i.source = $${params.length}`);
  }
  if (f.sentiment) {
    params.push(f.sentiment);
    conds.push(`e.sentiment = $${params.length}`);
  }
  if (f.topic) {
    params.push(f.topic);
    conds.push(`e.topics @> ARRAY[$${params.length}]::text[]`);
  }
  return { where: conds.join(" and "), params };
}

function defaultFrom(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

export interface OverviewStats {
  mentions: number;
  weighted_sentiment: number;
  avg_sentiment: number;
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
  located: number;
}

export async function overviewStats(f: Filters = {}): Promise<OverviewStats> {
  const { where, params } = buildWhere({ from: defaultFrom(7), ...f });
  const rows = await query<Record<string, string>>(
    `select
       count(*)::int as mentions,
       coalesce(sum(e.sentiment_score * (${ENG_WEIGHT})) / nullif(sum(${ENG_WEIGHT}), 0), 0) as weighted_sentiment,
       coalesce(avg(e.sentiment_score), 0) as avg_sentiment,
       count(*) filter (where e.sentiment = 'positive')::int as positive,
       count(*) filter (where e.sentiment = 'negative')::int as negative,
       count(*) filter (where e.sentiment = 'neutral')::int as neutral,
       count(*) filter (where e.sentiment = 'mixed')::int as mixed,
       count(*) filter (where e.location_country is not null)::int as located
     from item_enrichments e join items i on i.id = e.item_id
     where ${where}`,
    params,
  );
  const r = rows[0] ?? {};
  return {
    mentions: Number(r.mentions ?? 0),
    weighted_sentiment: Number(r.weighted_sentiment ?? 0),
    avg_sentiment: Number(r.avg_sentiment ?? 0),
    positive: Number(r.positive ?? 0),
    negative: Number(r.negative ?? 0),
    neutral: Number(r.neutral ?? 0),
    mixed: Number(r.mixed ?? 0),
    located: Number(r.located ?? 0),
  };
}

export interface SeriesPoint {
  bucket: string;
  mentions: number;
  sentiment: number;
}

export async function timeseriesDaily(days = 30, f: Filters = {}): Promise<SeriesPoint[]> {
  const { where, params } = buildWhere({ from: defaultFrom(days), ...f });
  const rows = await query<Record<string, string>>(
    `select to_char(date_trunc('day', i.published_at), 'YYYY-MM-DD') as bucket,
       count(*)::int as mentions,
       coalesce(sum(e.sentiment_score * (${ENG_WEIGHT})) / nullif(sum(${ENG_WEIGHT}), 0), 0) as sentiment
     from item_enrichments e join items i on i.id = e.item_id
     where ${where}
     group by 1 order by 1`,
    params,
  );
  return rows.map((r) => ({ bucket: r.bucket, mentions: Number(r.mentions), sentiment: Number(r.sentiment) }));
}

export interface GroupStat {
  key: string;
  mentions: number;
  sentiment: number;
  negative: number;
  positive: number;
}

export async function byCountry(days = 7, f: Filters = {}): Promise<GroupStat[]> {
  const { where, params } = buildWhere({ from: defaultFrom(days), ...f, country: null });
  const rows = await query<Record<string, string>>(
    `select e.location_country as key,
       count(*)::int as mentions,
       coalesce(sum(e.sentiment_score * (${ENG_WEIGHT})) / nullif(sum(${ENG_WEIGHT}), 0), 0) as sentiment,
       count(*) filter (where e.sentiment = 'negative')::int as negative,
       count(*) filter (where e.sentiment = 'positive')::int as positive
     from item_enrichments e join items i on i.id = e.item_id
     where ${where} and e.location_country is not null
     group by 1 order by mentions desc limit 20`,
    params,
  );
  return rows.map(mapGroup);
}

export async function bySource(days = 7, f: Filters = {}): Promise<GroupStat[]> {
  const { where, params } = buildWhere({ from: defaultFrom(days), ...f, source: null });
  const rows = await query<Record<string, string>>(
    `select i.source as key,
       count(*)::int as mentions,
       coalesce(sum(e.sentiment_score * (${ENG_WEIGHT})) / nullif(sum(${ENG_WEIGHT}), 0), 0) as sentiment,
       count(*) filter (where e.sentiment = 'negative')::int as negative,
       count(*) filter (where e.sentiment = 'positive')::int as positive
     from item_enrichments e join items i on i.id = e.item_id
     where ${where}
     group by 1 order by mentions desc`,
    params,
  );
  return rows.map(mapGroup);
}

export async function byTopic(days = 7, f: Filters = {}, limit = 20): Promise<GroupStat[]> {
  const { where, params } = buildWhere({ from: defaultFrom(days), ...f, topic: null });
  const rows = await query<Record<string, string>>(
    `select t as key,
       count(*)::int as mentions,
       coalesce(sum(e.sentiment_score * (${ENG_WEIGHT})) / nullif(sum(${ENG_WEIGHT}), 0), 0) as sentiment,
       count(*) filter (where e.sentiment = 'negative')::int as negative,
       count(*) filter (where e.sentiment = 'positive')::int as positive
     from item_enrichments e join items i on i.id = e.item_id
     cross join lateral unnest(e.topics) as t
     where ${where}
     group by 1 order by mentions desc limit ${Number(limit)}`,
    params,
  );
  return rows.map(mapGroup);
}

function mapGroup(r: Record<string, string>): GroupStat {
  return {
    key: r.key,
    mentions: Number(r.mentions),
    sentiment: Number(r.sentiment),
    negative: Number(r.negative),
    positive: Number(r.positive),
  };
}

export interface EmergingTopic {
  topic: string;
  current: number;
  previous: number;
  delta: number | null;
}

export async function emergingTopics(f: Filters = {}): Promise<EmergingTopic[]> {
  const { where, params } = buildWhere({ ...f, from: null, to: null });
  const base = `from item_enrichments e join items i on i.id = e.item_id
     cross join lateral unnest(e.topics) as t
     where ${where}`;
  const rows = await query<Record<string, string>>(
    `with cur as (
       select t as topic, count(*)::int as c ${base} and i.published_at >= now() - interval '7 days' group by 1
     ), prev as (
       select t as topic, count(*)::int as c ${base}
         and i.published_at >= now() - interval '14 days' and i.published_at < now() - interval '7 days'
       group by 1
     )
     select cur.topic, cur.c as current, coalesce(prev.c, 0) as previous,
       case when coalesce(prev.c, 0) = 0 then null else (cur.c - prev.c)::numeric / prev.c end as delta
     from cur left join prev using (topic)
     where cur.c >= 3
     order by delta desc nulls first, current desc
     limit 10`,
    params,
  );
  return rows.map((r) => ({
    topic: r.topic,
    current: Number(r.current),
    previous: Number(r.previous),
    delta: r.delta == null ? null : Number(r.delta),
  }));
}

export interface HourlyPoint {
  hour: number;
  mentions: number;
  sentiment: number;
}

export async function hourlySentiment(days = 14, f: Filters = {}): Promise<HourlyPoint[]> {
  const { where, params } = buildWhere({ from: defaultFrom(days), ...f });
  const rows = await query<Record<string, string>>(
    `select e.local_hour as hour,
       count(*)::int as mentions,
       coalesce(sum(e.sentiment_score * (${ENG_WEIGHT})) / nullif(sum(${ENG_WEIGHT}), 0), 0) as sentiment
     from item_enrichments e join items i on i.id = e.item_id
     where ${where} and e.local_hour is not null
     group by 1 order by 1`,
    params,
  );
  return rows.map((r) => ({ hour: Number(r.hour), mentions: Number(r.mentions), sentiment: Number(r.sentiment) }));
}

export interface FunnelRow {
  stage: string;
  mentions: number;
  sentiment: number;
  negative: number;
}

const STAGES = ["signup", "kyc", "deposit", "trading", "withdrawal", "support"];

export async function funnelStats(days = 7, f: Filters = {}): Promise<FunnelRow[]> {
  const { where, params } = buildWhere({ from: defaultFrom(days), ...f });
  const rows = await query<Record<string, string>>(
    `select e.journey_stage as stage,
       count(*)::int as mentions,
       coalesce(sum(e.sentiment_score * (${ENG_WEIGHT})) / nullif(sum(${ENG_WEIGHT}), 0), 0) as sentiment,
       count(*) filter (where e.sentiment = 'negative')::int as negative
     from item_enrichments e join items i on i.id = e.item_id
     where ${where} and e.journey_stage = any($${params.length + 1}::text[])
     group by 1`,
    [...params, STAGES],
  );
  const byStage = new Map(rows.map((r) => [r.stage, mapFunnel(r)]));
  return STAGES.map((s) => byStage.get(s) ?? { stage: s, mentions: 0, sentiment: 0, negative: 0 });
}

function mapFunnel(r: Record<string, string>): FunnelRow {
  return {
    stage: r.stage,
    mentions: Number(r.mentions),
    sentiment: Number(r.sentiment),
    negative: Number(r.negative),
  };
}

export interface AspectRow {
  stage: string | null;
  aspect: string;
  negative: number;
}

export async function topNegativeAspects(days = 7, f: Filters = {}, limit = 15): Promise<AspectRow[]> {
  const { where, params } = buildWhere({ from: defaultFrom(days), ...f });
  const rows = await query<Record<string, string>>(
    `select e.journey_stage as stage, a->>'name' as aspect, count(*)::int as negative
     from item_enrichments e join items i on i.id = e.item_id
     cross join lateral jsonb_array_elements(e.aspects) a
     where ${where} and a->>'sentiment' = 'negative'
     group by 1, 2 order by 3 desc limit ${Number(limit)}`,
    params,
  );
  return rows.map((r) => ({ stage: r.stage, aspect: r.aspect, negative: Number(r.negative) }));
}

export interface MentionRow {
  id: number;
  source: string;
  source_id: string;
  url: string | null;
  title: string | null;
  content: string;
  sentiment: string | null;
  sentiment_score: number;
  topics: string[];
  country: string | null;
  stage: string | null;
  published_at: string;
  engagement: number;
}

export async function topMentions(
  f: Filters = {},
  opts: { sentiment?: string | null; limit?: number } = {},
): Promise<MentionRow[]> {
  const limit = opts.limit ?? 20;
  const { where, params } = buildWhere({ ...f, sentiment: opts.sentiment ?? f.sentiment ?? null });
  const rows = await query<Record<string, string>>(
    `select i.id, i.source, i.source_id, i.url, i.title, left(i.content, 400) as content, e.sentiment,
       e.sentiment_score, e.topics, e.location_country, e.journey_stage,
       to_char(i.published_at, 'YYYY-MM-DD HH24:MI') as published_at,
       (${ENG_WEIGHT})::int as engagement
     from item_enrichments e join items i on i.id = e.item_id
     where ${where}
     order by (${ENG_WEIGHT}) * abs(e.sentiment_score) desc nulls last
     limit ${limit}`,
    params,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    source: r.source,
    source_id: r.source_id,
    url: r.url,
    title: r.title,
    content: r.content,
    sentiment: r.sentiment,
    sentiment_score: Number(r.sentiment_score),
    topics: (r.topics as unknown as string[]) ?? [],
    country: r.location_country,
    stage: r.journey_stage,
    published_at: r.published_at,
    engagement: Number(r.engagement),
  }));
}

export interface CostDaily {
  day: string;
  cost: number;
  calls: number;
  input_tokens: number;
  output_tokens: number;
}

export async function costDaily(days = 14): Promise<{ daily: CostDaily[]; total: number; byPurpose: { purpose: string; cost: number; calls: number }[] }> {
  const rows = await query<Record<string, string>>(
    `select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
       coalesce(sum(cost_usd), 0) as cost, count(*)::int as calls,
       coalesce(sum(input_tokens), 0)::int as input_tokens,
       coalesce(sum(output_tokens), 0)::int as output_tokens
     from llm_usage
     where created_at >= now() - (${days} || ' days')::interval
     group by 1 order by 1`,
  );
  const purpose = await query<Record<string, string>>(
    `select purpose, coalesce(sum(cost_usd), 0) as cost, count(*)::int as calls
     from llm_usage
     where created_at >= now() - (${days} || ' days')::interval
     group by 1 order by 2 desc`,
  );
  return {
    daily: rows.map((r) => ({
      day: r.day,
      cost: Number(r.cost),
      calls: Number(r.calls),
      input_tokens: Number(r.input_tokens),
      output_tokens: Number(r.output_tokens),
    })),
    total: rows.reduce((s, r) => s + Number(r.cost), 0),
    byPurpose: purpose.map((r) => ({ purpose: r.purpose, cost: Number(r.cost), calls: Number(r.calls) })),
  };
}

export async function countByDay(days = 7, f: Filters = {}): Promise<number> {
  const { where, params } = buildWhere({ from: defaultFrom(days), ...f });
  const rows = await query<{ c: string }>(
    `select count(*)::int as c from item_enrichments e join items i on i.id = e.item_id where ${where}`,
    params,
  );
  return Number(rows[0]?.c ?? 0);
}
