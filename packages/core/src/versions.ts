import { query } from "./db";

export interface VersionRow {
  version: string;
  mentions: number;
  avg_rating: number;
  sentiment: number;
  negative: number;
  top_aspects: { name: string; sentiment: string }[];
  top_topics: string[];
  first_seen: string | null;
  last_seen: string | null;
}

export async function gplayByVersion(days = 90, limit = 20): Promise<VersionRow[]> {
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = await query<Record<string, string>>(
    `with base as (
       select i.id, i.metadata->>'appVersion' as version,
         (i.engagement->>'score')::numeric as rating,
         e.sentiment, e.sentiment_score, e.aspects, e.topics, i.published_at
       from item_enrichments e join items i on i.id = e.item_id
       where i.source = 'gplay' and e.is_bot = false and e.sentiment is not null
         and i.metadata->>'appVersion' is not null
         and i.published_at >= $1::timestamptz
     )
     select version, count(*)::int as mentions,
       coalesce(avg(rating), 0) as avg_rating,
       coalesce(avg(sentiment_score), 0) as sentiment,
       count(*) filter (where sentiment = 'negative')::int as negative,
       to_char(min(published_at), 'YYYY-MM-DD') as first_seen,
       to_char(max(published_at), 'YYYY-MM-DD') as last_seen
     from base
     where version <> 'null' and version <> ''
     group by 1 having count(*) >= 2
     order by last_seen desc, mentions desc
     limit ${Math.min(Math.max(limit, 1), 50)}`,
    [from],
  );

  const out: VersionRow[] = [];
  for (const r of rows) {
    const detail = await query<Record<string, string>>(
      `select (a->>'name') as name, (a->>'sentiment') as senti, count(*)::int as c
       from item_enrichments e join items i on i.id = e.item_id
       cross join lateral jsonb_array_elements(e.aspects) a
       where i.source = 'gplay' and e.is_bot = false
         and i.metadata->>'appVersion' = $1
         and i.published_at >= $2::timestamptz
       group by 1, 2 order by c desc limit 3`,
      [r.version, from],
    );
    const topics = await query<Record<string, string>>(
      `select t, count(*)::int as c
       from item_enrichments e join items i on i.id = e.item_id
       cross join lateral unnest(e.topics) as t
       where i.source = 'gplay' and e.is_bot = false
         and i.metadata->>'appVersion' = $1
         and i.published_at >= $2::timestamptz
       group by 1 order by c desc limit 3`,
      [r.version, from],
    );
    out.push({
      version: r.version,
      mentions: Number(r.mentions),
      avg_rating: Number(Number(r.avg_rating).toFixed(2)),
      sentiment: Number(r.sentiment),
      negative: Number(r.negative),
      top_aspects: detail.map((d) => ({ name: d.name, sentiment: d.senti })),
      top_topics: topics.map((t) => t.t),
      first_seen: r.first_seen ?? null,
      last_seen: r.last_seen ?? null,
    });
  }
  return out;
}
