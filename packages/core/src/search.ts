import { embed } from "@deriv-intel/llm";
import { query } from "./db";
import { buildWhere, ENG_WEIGHT, type Filters, type MentionRow } from "./analytics";

export type SearchRow = MentionRow & { score: number };

function mapRow(r: Record<string, string>): SearchRow {
  return {
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
    language: r.language ?? null,
    published_at: r.published_at,
    engagement: Number(r.engagement),
    score: Number(r.score ?? 0),
  };
}

const SELECT = `select i.id, i.source, i.source_id, i.url, i.title, left(i.content, 400) as content,
  e.sentiment, e.sentiment_score, e.topics, e.location_country, e.journey_stage,
  coalesce(e.language, i.language) as language,
  to_char(i.published_at, 'YYYY-MM-DD HH24:MI') as published_at,
  (${ENG_WEIGHT})::int as engagement`;

export async function hybridSearch(q: string, filters: Filters = {}, limit = 30): Promise<SearchRow[]> {
  const trimmed = (q || "").trim();
  limit = Math.min(Math.max(Number(limit) || 30, 1), 100);

  if (!trimmed) {
    const { where, params } = buildWhere(filters);
    const rows = await query<Record<string, string>>(
      `${SELECT}, 0 as score
       from item_enrichments e join items i on i.id = e.item_id
       where ${where}
       order by i.published_at desc limit ${limit}`,
      params,
    );
    return rows.map(mapRow);
  }

  let vec: number[] | null = null;
  try {
    const res = await embed([trimmed], "search");
    vec = res[0] ?? null;
  } catch {
    vec = null;
  }

  const extra: string[] = ["e.item_id is not null", "e.is_bot = false"];
  const brand = (filters.brand || "deriv").trim().toLowerCase();
  const params: unknown[] = [trimmed];
  if (brand === "*") {
    extra.push("e.brands <> '{}'");
  } else {
    params.push(brand);
    extra.push(`e.brands @> ARRAY[$${params.length}]::text[]`);
  }
  if (vec) params.push(JSON.stringify(vec));
  const vecParam = vec ? `$${params.length}::vector` : null;
  for (const [k, v] of Object.entries(filters)) {
    if (v == null || v === "") continue;
    if (k === "brand") continue;
    params.push(v);
    const n = params.length;
    if (k === "country") extra.push(`e.location_country = $${n}`);
    else if (k === "source") extra.push(`i.source = $${n}`);
    else if (k === "sentiment") extra.push(`e.sentiment = $${n}`);
    else if (k === "topic") extra.push(`e.topics @> ARRAY[$${n}]::text[]`);
    else if (k === "from") extra.push(`i.published_at >= $${n}::timestamptz`);
    else if (k === "to") extra.push(`i.published_at <= $${n}::timestamptz`);
  }

  const ftsCte = `fts as (
    select i.id, row_number() over (order by ts_rank(to_tsvector('simple', coalesce(i.title, '') || ' ' || i.content), websearch_to_tsquery('simple', $1)) desc) as rn
    from items i
    where to_tsvector('simple', coalesce(i.title, '') || ' ' || i.content) @@ websearch_to_tsquery('simple', $1)
    limit 100
  )`;
  const semCte = vecParam
    ? `sem as (
        select emb.item_id as id, row_number() over (order by emb.embedding <=> ${vecParam}) as rn
        from item_embeddings emb
        order by emb.embedding <=> ${vecParam}
        limit 100
      )`
    : `sem as (select null::bigint as id, null::bigint as rn where false)`;
  const rrfCte = vec
    ? `rrf as (
        select coalesce(f.id, s.id) as id,
          coalesce(1.0 / (60 + f.rn), 0) + coalesce(1.0 / (60 + s.rn), 0) as score
        from fts f full outer join sem s on f.id = s.id
      )`
    : `rrf as (select f.id as id, 1.0 / (60 + f.rn) as score from fts f)`;

  const rows = await query<Record<string, string>>(
    `with ${ftsCte}, ${semCte}, ${rrfCte}
     ${SELECT}, rrf.score as score
     from rrf
     join items i on i.id = rrf.id
     left join item_enrichments e on e.item_id = i.id
     where ${extra.join(" and ")}
     order by rrf.score desc
     limit ${limit}`,
    params,
  );
  return rows.map(mapRow);
}
