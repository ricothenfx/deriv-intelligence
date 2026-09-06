import { chatText, parseJson } from "@deriv-intel/llm";
import { query } from "./db";
import { ENG_WEIGHT } from "./analytics";

export interface DailyMetric {
  day: string;
  sentiment: number;
  mentions: number;
  gplay_rating: number | null;
  gplay_negative: number;
}

export interface Correlation {
  name: string;
  description: string;
  r: number | null;
  note: string;
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 4) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    dx += (xs[i]! - mx) ** 2;
    dy += (ys[i]! - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return Number((num / Math.sqrt(dx * dy)).toFixed(3));
}

export async function dailySeries(days = 30): Promise<DailyMetric[]> {
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = await query<Record<string, string>>(
    `select to_char(date_trunc('day', i.published_at), 'YYYY-MM-DD') as day,
       coalesce(sum(e.sentiment_score * (${ENG_WEIGHT})) / nullif(sum(${ENG_WEIGHT}), 0), 0) as sentiment,
       count(*)::int as mentions,
       avg((i.engagement->>'score')::numeric) filter (where i.source = 'gplay') as gplay_rating,
       count(*) filter (where i.source = 'gplay' and e.sentiment = 'negative')::int as gplay_negative
     from item_enrichments e join items i on i.id = e.item_id
     where e.is_bot = false and e.sentiment is not null
       and e.brands @> ARRAY['deriv']::text[]
       and i.published_at >= $1::timestamptz
     group by 1 order by 1`,
    [from],
  );
  return rows.map((r) => ({
    day: r.day,
    sentiment: Number(Number(r.sentiment).toFixed(3)),
    mentions: Number(r.mentions),
    gplay_rating: r.gplay_rating == null ? null : Number(Number(r.gplay_rating).toFixed(2)),
    gplay_negative: Number(r.gplay_negative),
  }));
}

export async function correlations(days = 30): Promise<{
  series: DailyMetric[];
  correlations: Correlation[];
  weekday_pattern: { weekday: string; sentiment: number; mentions: number }[];
}> {
  const series = await dailySeries(days);

  const rated = series.filter((d) => d.gplay_rating != null);
  const cVolume = pearson(series.map((d) => d.mentions), series.map((d) => d.sentiment));
  const cRating = pearson(rated.map((d) => d.gplay_rating!), rated.map((d) => d.sentiment));
  const cComplaints = pearson(series.map((d) => d.gplay_negative), series.map((d) => d.sentiment));

  const weekdayRows = await query<Record<string, string>>(
    `select extract(dow from i.published_at)::int as dow,
       coalesce(sum(e.sentiment_score * (${ENG_WEIGHT})) / nullif(sum(${ENG_WEIGHT}), 0), 0) as sentiment,
       count(*)::int as mentions
     from item_enrichments e join items i on i.id = e.item_id
     where e.is_bot = false and e.sentiment is not null
       and e.brands @> ARRAY['deriv']::text[]
       and i.published_at >= now() - ($1 || ' days')::interval
     group by 1 order by 1`,
    [String(days)],
  );
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    series,
    correlations: [
      {
        name: "Mention volume vs sentiment",
        description: "Pearson correlation between daily mention count and weighted sentiment",
        r: cVolume,
        note: cVolume == null ? "not enough days" : cVolume < -0.4 ? "higher volume days tend to be more negative (complaint-driven spikes)" : cVolume > 0.4 ? "higher volume days tend to be more positive" : "no strong relationship",
      },
      {
        name: "App Store rating vs sentiment",
        description: "Daily Google Play average rating vs weighted social sentiment",
        r: cRating,
        note: cRating == null ? "not enough rated days" : cRating > 0.3 ? "store rating and social sentiment move together" : "store rating and social sentiment are largely independent channels",
      },
      {
        name: "Complaint count vs sentiment",
        description: "Daily gplay negative review count vs weighted sentiment",
        r: cComplaints,
        note: cComplaints == null ? "not enough days" : cComplaints < -0.3 ? "sentiment dips align with review complaint bursts" : "complaint bursts do not dominate overall sentiment",
      },
    ],
    weekday_pattern: weekdayRows.map((r) => ({
      weekday: names[Number(r.dow)] ?? String(r.dow),
      sentiment: Number(Number(r.sentiment).toFixed(3)),
      mentions: Number(r.mentions),
    })),
  };
}

export interface FaqRow {
  id: number;
  question: string;
  answer: string;
  language: string | null;
  created_at: string;
}

export async function listFaqs(limit = 30): Promise<FaqRow[]> {
  const rows = await query<Record<string, string>>(
    `select id, question, answer, language, to_char(created_at, 'YYYY-MM-DD HH24:MI') as created_at
     from faqs order by created_at desc limit ${Math.min(Math.max(limit, 1), 100)}`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    question: r.question,
    answer: r.answer,
    language: r.language ?? null,
    created_at: r.created_at,
  }));
}

export async function generateFaqs(maxQuestions = 12): Promise<{ created: number }> {
  const candidates = await query<Record<string, string>>(
    `select i.id, i.content, e.language, e.journey_stage, e.topics
     from item_enrichments e join items i on i.id = e.item_id
     where e.is_bot = false and e.sentiment is not null
       and e.brands @> ARRAY['deriv']::text[]
       and i.content ~* '[?](.|$)'
       and i.source <> 'tavily'
       and i.published_at >= now() - interval '45 days'
     order by (${ENG_WEIGHT}) desc, i.published_at desc
     limit 120`,
  );
  if (!candidates.length) return { created: 0 };

  const payload = candidates.slice(0, 80).map((c) => ({
    id: Number(c.id),
    text: c.content.slice(0, 240),
    stage: c.journey_stage,
    topics: c.topics,
  }));

  const raw = await chatText({
    tier: "strong",
    purpose: "faq",
    messages: [
      {
        role: "system",
        content:
          'You generate an FAQ for a trading platform support site from REAL user posts (reviews, comments). Cluster similar questions and write concise, helpful answers grounded ONLY in what users commonly ask — no invented product facts. Answers must be in the same language as the dominant cluster language (usually the post language). Return strict JSON {"faqs":[{"question":"...","answer":"...","language":"en","source_ids":[1,2]}]} with at most ' +
          String(maxQuestions) +
          " entries. source_ids must reference input ids.",
      },
      { role: "user", content: JSON.stringify(payload).slice(0, 40000) },
    ],
    json: true,
    temperature: 0.2,
    maxTokens: 3000,
  });

  let created = 0;
  try {
    const parsed = parseJson<{ faqs?: { question?: string; answer?: string; language?: string; source_ids?: number[] }[] }>(raw);
    const faqs = (parsed.faqs ?? []).filter((f) => f.question && f.answer).slice(0, maxQuestions);
    for (const f of faqs) {
      await query(
        `insert into faqs (question, answer, language, sources) values ($1, $2, $3, $4::bigint[])`,
        [f.question!.slice(0, 400), f.answer!.slice(0, 1500), f.language ?? null, (f.source_ids ?? []).slice(0, 20)],
      );
      created++;
    }
  } catch (e) {
    console.error("faq LLM parse failed:", e);
  }
  return { created };
}
