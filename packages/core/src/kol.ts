import { query } from "./db";
import { ENG_WEIGHT } from "./analytics";

export interface KolRow {
  author: string;
  source: string;
  mentions: number;
  total_engagement: number;
  avg_sentiment: number;
  negative_share: number;
  countries: string[];
  topics: string[];
  score: number;
  last_active: string | null;
}

export async function kolRadar(days = 30, limit = 30): Promise<KolRow[]> {
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = await query<Record<string, string>>(
    `with base as (
       select i.author, i.source, e.sentiment, e.sentiment_score, e.location_country, e.topics,
         (${ENG_WEIGHT}) as w, i.published_at
       from item_enrichments e join items i on i.id = e.item_id
       where e.is_bot = false and e.sentiment is not null and i.author is not null
         and i.author <> '' and e.brands <> '{}'
         and i.published_at >= $1::timestamptz
     ), agg as (
       select author, max(source) as source,
         count(*)::int as mentions,
         coalesce(sum(w), 0) as total_engagement,
         coalesce(avg(sentiment_score), 0) as avg_sentiment,
         count(*) filter (where sentiment = 'negative')::numeric / count(*) as negative_share,
         array_agg(distinct location_country) filter (where location_country is not null) as countries,
         to_char(max(published_at), 'YYYY-MM-DD') as last_active
       from base
       group by author
     )
     select agg.*,
       coalesce((
         select array_agg(t order by tc desc)
         from (
           select t, count(*) as tc from base b2
           cross join lateral unnest(b2.topics) as t
           where b2.author = agg.author group by t order by tc desc limit 3
         ) top
       ), '{}') as topics
     from agg
     where author not like 'seed-%' and author not like '%_user_%'
     order by total_engagement * ln(1 + mentions) * (1 + mentions * negative_share) desc
     limit ${Math.min(Math.max(limit, 1), 100)}`,
    [from],
  );
  return rows.map((r) => ({
    author: r.author,
    source: r.source,
    mentions: Number(r.mentions),
    total_engagement: Number(r.total_engagement),
    avg_sentiment: Number(r.avg_sentiment),
    negative_share: Number(r.negative_share),
    countries: (r.countries as unknown as string[]) ?? [],
    topics: (r.topics as unknown as string[]) ?? [],
    score: Number(
      (Number(r.total_engagement) * Math.log(1 + Number(r.mentions)) * (1 + Number(r.mentions) * Number(r.negative_share))).toFixed(1),
    ),
    last_active: r.last_active ?? null,
  }));
}
