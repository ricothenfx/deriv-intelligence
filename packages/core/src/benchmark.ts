import { query } from "./db";
import { ENG_WEIGHT, type Filters } from "./analytics";

export interface BrandStat {
  brand: string;
  mentions: number;
  sentiment: number;
  negative: number;
  positive: number;
  avg_engagement: number;
  share: number;
}

export interface BrandAspectRow {
  brand: string;
  aspect: string;
  sentiment: number;
  mentions: number;
}

export interface SwitcherRow {
  from_brand: string;
  to_brand: string;
  mentions: number;
  sample: string;
  url: string | null;
  published_at: string | null;
}

function fromISO(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

export async function benchmarkByBrand(f: Filters = {}): Promise<BrandStat[]> {
  const from = f.from ?? fromISO(30);
  const rows = await query<Record<string, string>>(
    `with base as (
       select b as brand, e.sentiment_score, e.sentiment,
         (${ENG_WEIGHT}) as w
       from item_enrichments e join items i on i.id = e.item_id
       cross join lateral unnest(e.brands) as b
       where e.is_bot = false and e.sentiment is not null and e.brands <> '{}'
         and i.published_at >= $1::timestamptz
         and ($2::text is null or e.location_country = $2)
     )
     select brand, count(*)::int as mentions,
       coalesce(sum(sentiment_score * w) / nullif(sum(w), 0), 0) as sentiment,
       count(*) filter (where sentiment = 'negative')::int as negative,
       count(*) filter (where sentiment = 'positive')::int as positive,
       coalesce(avg(w), 0) as avg_engagement
     from base group by 1 order by 2 desc`,
    [from, f.country ?? null],
  );
  const total = rows.reduce((s, r) => s + Number(r.mentions), 0) || 1;
  return rows.map((r) => ({
    brand: r.brand,
    mentions: Number(r.mentions),
    sentiment: Number(r.sentiment),
    negative: Number(r.negative),
    positive: Number(r.positive),
    avg_engagement: Number(r.avg_engagement),
    share: Number(r.mentions) / total,
  }));
}

export async function brandAspects(f: Filters = {}, limit = 6): Promise<BrandAspectRow[]> {
  const from = f.from ?? fromISO(30);
  const rows = await query<Record<string, string>>(
    `with base as (
       select b as brand, (a->>'name') as aspect, (a->>'sentiment')::text as senti, e.sentiment_score
       from item_enrichments e join items i on i.id = e.item_id
       cross join lateral unnest(e.brands) as b
       cross join lateral jsonb_array_elements(e.aspects) as a
       where e.is_bot = false and e.sentiment is not null and e.brands <> '{}'
         and i.published_at >= $1::timestamptz
         and ($2::text is null or e.location_country = $2)
     )
     select brand, aspect,
       coalesce(avg(case when senti = 'positive' then 1 when senti = 'negative' then -1 else 0 end), 0) as sentiment,
       count(*)::int as mentions
     from base group by 1, 2 having count(*) >= 2
     order by brand, mentions desc
     limit ${Math.min(Math.max(limit, 1), 12) * 8}`,
    [from, f.country ?? null],
  );
  const out: BrandAspectRow[] = [];
  const counts = new Map<string, number>();
  for (const r of rows) {
    const brand = r.brand;
    if ((counts.get(brand) ?? 0) >= limit) continue;
    counts.set(brand, (counts.get(brand) ?? 0) + 1);
    out.push({ brand, aspect: r.aspect, sentiment: Number(r.sentiment), mentions: Number(r.mentions) });
  }
  return out;
}

export async function switchers(f: Filters = {}, limit = 20): Promise<SwitcherRow[]> {
  const from = f.from ?? fromISO(90);
  const rows = await query<Record<string, string>>(
    `with multi as (
       select i.id, i.url, i.content, i.published_at, e.brands,
         (${ENG_WEIGHT}) as w,
         row_number() over (partition by i.id order by (${ENG_WEIGHT})) as rn
       from item_enrichments e join items i on i.id = e.item_id
       where e.is_bot = false and e.sentiment is not null
         and array_length(e.brands, 1) >= 2
         and i.published_at >= $1::timestamptz
         and i.content ~* '(switch(ed|ing)?|moved?|migrat(e|ed|ion)|transfer(red)?|pindah|switch ke|better than|instead of|lebih baik (dari|daripada)|dari .* ke .*)'
     )
     select b1 as from_brand, b2 as to_brand, count(*)::int as mentions
     from multi
     join lateral unnest(multi.brands) b1 on true
     join lateral unnest(multi.brands) b2 on b1 < b2
     group by 1, 2 order by 3 desc`,
    [from],
  );
  const pairs = rows.slice(0, Math.min(Math.max(limit, 1), 50));
  const out: SwitcherRow[] = [];
  for (const p of pairs) {
    const [fromB, toB] = [p.from_brand, p.to_brand];
    const sample = await query<Record<string, string>>(
      `select i.content, i.url, to_char(i.published_at, 'YYYY-MM-DD') as published_at
       from item_enrichments e join items i on i.id = e.item_id
       where e.is_bot = false and e.brands @> ARRAY[$1, $2]::text[]
         and i.content ~* '(switch(ed|ing)?|moved?|migrat(e|ed|ion)|transfer(red)?|pindah|better than|instead of|lebih baik)'
       order by (${ENG_WEIGHT}) desc limit 1`,
      [fromB, toB],
    );
    const s = sample[0];
    out.push({
      from_brand: fromB,
      to_brand: toB,
      mentions: Number(p.mentions),
      sample: s ? s.content.slice(0, 220) : "",
      url: s?.url ?? null,
      published_at: s?.published_at ?? null,
    });
  }
  return out;
}
