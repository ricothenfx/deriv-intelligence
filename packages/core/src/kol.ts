import { query } from "./db";
import { ENG_WEIGHT } from "./analytics";

export interface KolRow {
  author: string;
  source: string;
  profile_url: string | null;
  example_url: string | null;
  mentions: number;
  total_engagement: number;
  avg_sentiment: number;
  negative_share: number;
  countries: string[];
  topics: string[];
  score: number;
  reach: number | null;
  last_active: string | null;
}

export async function kolRadar(days = 30, limit = 30): Promise<KolRow[]> {
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = await query<Record<string, string>>(
    `with base as (
       select i.author, i.source, i.url, i.metadata, e.sentiment, e.sentiment_score, e.location_country, e.topics,
         (${ENG_WEIGHT}) as w, i.published_at,
         case
           when i.source = 'youtube' and i.metadata->>'authorChannelId' is not null then 'yt:' || (i.metadata->>'authorChannelId')
           when i.source = 'youtube' and i.metadata->>'channelId' is not null then 'yt:' || (i.metadata->>'channelId')
           when i.source = 'reddit' then 'reddit:' || lower(i.author)
           else lower(i.source) || ':' || lower(i.author)
         end as author_key,
         case
           when i.source = 'reddit' and i.author is not null and i.author <> ''
             then 'https://www.reddit.com/user/' || i.author
           when i.metadata->>'authorChannelId' is not null
             then 'https://www.youtube.com/channel/' || (i.metadata->>'authorChannelId')
           when i.metadata->>'channelId' is not null
             then 'https://www.youtube.com/channel/' || (i.metadata->>'channelId')
           else null
         end as author_url,
         case when i.metadata->>'channelSubs' ~ '^[0-9]+$'
           then (i.metadata->>'channelSubs')::bigint else null end as subs
       from item_enrichments e join items i on i.id = e.item_id
       where e.is_bot = false and e.sentiment is not null and i.author is not null
         and i.author <> '' and e.brands @> ARRAY['deriv']::text[]
         and i.published_at >= $1::timestamptz
     ), agg as (
       select author_key, max(author) as author, max(source) as source,
         max(author_url) as profile_url,
         max(subs) as subs,
         (array_agg(url order by published_at desc nulls last) filter (where url is not null))[1] as example_url,
         count(*)::int as mentions,
         coalesce(sum(w), 0) as total_engagement,
         coalesce(avg(sentiment_score), 0) as avg_sentiment,
         count(*) filter (where sentiment = 'negative')::numeric / count(*) as negative_share,
         array_agg(distinct location_country) filter (where location_country is not null) as countries,
         to_char(max(published_at), 'YYYY-MM-DD') as last_active
       from base
       where author not like 'seed-%' and author not like '%_user_%'
       group by author_key
     )
     select agg.*,
       coalesce((
         select array_agg(t order by tc desc)
         from (
           select t, count(*) as tc from base b2
           cross join lateral unnest(b2.topics) as t
           where b2.author_key = agg.author_key group by t order by tc desc limit 3
         ) top
       ), '{}') as topics
     from agg
     order by total_engagement * ln(1 + mentions) * (1 + mentions * negative_share)
       * (case when subs is not null then ln(1 + subs) else 1 end) desc
     limit ${Math.min(Math.max(limit, 1), 100)}`,
    [from],
  );
  return rows.map((r) => ({
    author: r.author,
    source: r.source,
    profile_url: r.profile_url ?? null,
    example_url: r.example_url ?? null,
    mentions: Number(r.mentions),
    total_engagement: Number(r.total_engagement),
    avg_sentiment: Number(r.avg_sentiment),
    negative_share: Number(r.negative_share),
    countries: (r.countries as unknown as string[]) ?? [],
    topics: (r.topics as unknown as string[]) ?? [],
    score: Number(
      (
        Number(r.total_engagement) *
        Math.log(1 + Number(r.mentions)) *
        (1 + Number(r.mentions) * Number(r.negative_share)) *
        (r.subs == null ? 1 : Math.log(1 + Number(r.subs)))
      ).toFixed(1),
    ),
    reach: r.subs == null ? null : Number(r.subs),
    last_active: r.last_active ?? null,
  }));
}
