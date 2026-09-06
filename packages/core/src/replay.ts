import { query } from "./db";
import { ENG_WEIGHT } from "./analytics";

export interface ReplayBucket {
  bucket: string;
  country: string;
  mentions: number;
  sentiment: number;
}

export interface ReplayData {
  bucket_hours: number;
  buckets: string[];
  data: ReplayBucket[];
}

export async function timelineBuckets(days = 30, bucketHours = 6): Promise<ReplayData> {
  const hours = [1, 2, 3, 4, 6, 8, 12, 24].includes(bucketHours) ? bucketHours : 6;
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = await query<Record<string, string>>(
    `select to_char(date_trunc('hour', i.published_at) - (extract(hour from i.published_at)::int % $1) * interval '1 hour', 'YYYY-MM-DD"T"HH24:MI') as bucket,
       e.location_country as country,
       count(*)::int as mentions,
       coalesce(sum(e.sentiment_score * (${ENG_WEIGHT})) / nullif(sum(${ENG_WEIGHT}), 0), 0) as sentiment
     from item_enrichments e join items i on i.id = e.item_id
     where e.is_bot = false and e.sentiment is not null and e.location_country is not null
       and e.brands @> ARRAY['deriv']::text[]
       and i.published_at >= $2::timestamptz
     group by 1, 2 having count(*) >= 1
     order by 1`,
    [hours, from],
  );
  const bucketSet = new Set<string>();
  const data = rows.map((r) => {
    bucketSet.add(r.bucket);
    return {
      bucket: r.bucket,
      country: r.country,
      mentions: Number(r.mentions),
      sentiment: Number(Number(r.sentiment).toFixed(3)),
    };
  });
  return { bucket_hours: hours, buckets: [...bucketSet], data };
}
