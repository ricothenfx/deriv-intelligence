import { chatText } from "@deriv-intel/llm";
import { query } from "./db";
import { sendTelegram } from "./notify";
import { ENG_WEIGHT, topMentions, type MentionRow } from "./analytics";

type Metric = "volume" | "sentiment";

interface Candidate {
  metric: Metric;
  scope: string;
  country: string | null;
  topic: string | null;
  observed: number;
  baseline: number;
  z: number;
  windowStart: Date;
  windowEnd: Date;
  samples: MentionRow[];
}

const BASE_JOIN = `from item_enrichments e join items i on i.id = e.item_id`;

async function volumeAnomalies(dimension: "country" | "topic"): Promise<Candidate[]> {
  const key = dimension === "country" ? `e.location_country` : `t`;
  const unnest = dimension === "topic" ? `cross join lateral unnest(e.topics) as t` : "";
  const notNull = dimension === "country" ? `and e.location_country is not null` : "";
  const scopePrefix = dimension === "country" ? "country" : "topic";
  const rows = await query<Record<string, string>>(
    `with cur as (
       select ${key} as k, count(*)::int as c
       ${BASE_JOIN} ${unnest}
       where e.is_bot = false and e.sentiment is not null ${notNull}
         and i.published_at >= now() - interval '2 hours'
       group by 1 having count(*) >= 8
     ), hist as (
       select ${key} as k, date_trunc('day', i.published_at) as d, count(*)::int as c
       ${BASE_JOIN} ${unnest}
       where e.is_bot = false and e.sentiment is not null ${notNull}
         and i.published_at >= now() - interval '8 days' and i.published_at < now() - interval '2 hours'
       group by 1, 2
     ), bas as (
       select k, avg(c) as m, coalesce(stddev_samp(c), 0) as s, count(*)::int as n
       from hist group by 1
     )
     select cur.k, cur.c as observed, bas.m / 12.0 as baseline,
       (cur.c - bas.m / 12.0) / greatest(greatest(bas.s / 3.46, 0.8), 0.5) as z
     from cur join bas on bas.k = cur.k
     where bas.n >= 4`,
  );
  const out: Candidate[] = [];
  for (const r of rows) {
    const z = Number(r.z);
    if (z <= 3) continue;
    const k = String(r.k);
    const windowStart = new Date(Date.now() - 2 * 3600_000);
    const windowEnd = new Date();
    const samples = await topMentions(
      dimension === "country" ? { country: k, from: windowStart.toISOString() } : { topic: k, from: windowStart.toISOString() },
      { sentiment: "negative", limit: 5 },
    );
    out.push({
      metric: "volume",
      scope: `${scopePrefix}:${k}`,
      country: dimension === "country" ? k : null,
      topic: dimension === "topic" ? k : null,
      observed: Number(r.observed),
      baseline: Number(r.baseline),
      z,
      windowStart,
      windowEnd,
      samples,
    });
  }
  return out;
}

async function sentimentAnomalies(): Promise<Candidate[]> {
  const rows = await query<Record<string, string>>(
    `with cur as (
       select e.location_country as k,
         sum(e.sentiment_score * (${ENG_WEIGHT})) / nullif(sum(${ENG_WEIGHT}), 0) as s,
         count(*)::int as c
       ${BASE_JOIN}
       where e.is_bot = false and e.sentiment is not null and e.location_country is not null
         and i.published_at >= now() - interval '24 hours'
       group by 1 having count(*) >= 15
     ), hist as (
       select e.location_country as k, date_trunc('day', i.published_at) as d,
         sum(e.sentiment_score * (${ENG_WEIGHT})) / nullif(sum(${ENG_WEIGHT}), 0) as s
       ${BASE_JOIN}
       where e.is_bot = false and e.sentiment is not null and e.location_country is not null
         and i.published_at >= now() - interval '15 days' and i.published_at < now() - interval '1 day'
       group by 1, 2
     ), bas as (
       select k, avg(s) as m, coalesce(stddev_samp(s), 0) as s2, count(*)::int as n
       from hist group by 1
     )
     select * from (
       select cur.k, cur.s as observed, bas.m as baseline,
         (cur.s - bas.m) / greatest(bas.s2, 0.05) as z
       from cur join bas on bas.k = cur.k
       where bas.n >= 5
     ) x where z < -2.5`,
  );
  const out: Candidate[] = [];
  for (const r of rows) {
    const k = String(r.k);
    const windowStart = new Date(Date.now() - 24 * 3600_000);
    const windowEnd = new Date();
    const samples = await topMentions({ country: k, from: windowStart.toISOString() }, { sentiment: "negative", limit: 5 });
    out.push({
      metric: "sentiment",
      scope: `country:${k}`,
      country: k,
      topic: null,
      observed: Number(r.observed),
      baseline: Number(r.baseline),
      z: Number(r.z),
      windowStart,
      windowEnd,
      samples,
    });
  }
  return out;
}

function severityOf(c: Candidate): "low" | "medium" | "high" | "critical" {
  const z = Math.abs(c.z);
  if (c.metric === "volume") {
    if (z >= 6) return "critical";
    if (z >= 4.5) return "high";
    if (z >= 3.5) return "medium";
    return "low";
  }
  if (z >= 4) return "critical";
  if (z >= 3.2) return "high";
  if (z >= 2.8) return "medium";
  return "low";
}

async function explain(c: Candidate): Promise<string> {
  try {
    const sample = c.samples
      .slice(0, 5)
      .map((s, i) => `${i + 1}. [${s.country ?? "?"}] (${s.sentiment}) ${s.content.slice(0, 200)}`)
      .join("\n");
    return await chatText({
      tier: "strong",
      purpose: "anomaly",
      messages: [
        {
          role: "system",
          content:
            "You are a crisis analyst for a trading platform brand. Explain concisely (max 4 sentences) what is likely happening and the probable cause. Write in English, factual tone.",
        },
        {
          role: "user",
          content: `Anomaly: ${c.metric} spike in scope ${c.scope} (country=${c.country}, topic=${c.topic}). Observed=${c.observed.toFixed(2)}, baseline=${c.baseline.toFixed(2)}, z=${c.z.toFixed(2)}.\nSample posts:\n${sample || "(no samples)"}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 300,
    });
  } catch {
    return `Anomaly detected: observed ${c.observed.toFixed(2)} vs baseline ${c.baseline.toFixed(2)} (z=${c.z.toFixed(2)}).`;
  }
}

export interface AlertRow {
  id: number;
  created_at: string;
  metric: string;
  scope: string;
  country: string | null;
  topic: string | null;
  severity: string;
  confidence: number;
  z_score: number;
  baseline: number;
  observed: number;
  explanation: string | null;
  status: string;
  timeline: { at: string; event: string; detail: string }[];
}

export async function listAlerts(limit = 50): Promise<AlertRow[]> {
  const rows = await query<Record<string, string>>(
    `select id, to_char(created_at, 'YYYY-MM-DD HH24:MI') as created_at, metric, scope, country, topic,
       severity, confidence, z_score, baseline, observed, explanation, status, timeline
     from alerts order by created_at desc limit ${Math.min(Number(limit) || 50, 200)}`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    created_at: r.created_at,
    metric: r.metric,
    scope: r.scope,
    country: r.country,
    topic: r.topic,
    severity: r.severity,
    confidence: Number(r.confidence),
    z_score: Number(r.z_score),
    baseline: Number(r.baseline),
    observed: Number(r.observed),
    explanation: r.explanation,
    status: r.status,
    timeline: (r.timeline as unknown as AlertRow["timeline"]) ?? [],
  }));
}

export async function detectAnomalies(opts: { notify?: boolean } = {}): Promise<number> {
  const candidates = [
    ...(await volumeAnomalies("country")),
    ...(await volumeAnomalies("topic")),
    ...(await sentimentAnomalies()),
  ];
  let created = 0;
  for (const c of candidates) {
    const dup = await query<{ id: number }>(
      `select id from alerts where scope = $1 and status = 'open' and created_at > now() - interval '6 hours'`,
      [c.scope],
    );
    if (dup.length) continue;
    const severity = severityOf(c);
    const confidence = Number(Math.min(0.95, 0.5 + Math.abs(c.z) / 10).toFixed(2));
    const explanation = await explain(c);
    const timeline = [
      {
        at: c.windowStart.toISOString(),
        event: "Anomaly detected",
        detail: `${c.metric} observed ${c.observed.toFixed(2)} vs baseline ${c.baseline.toFixed(2)}`,
      },
      {
        at: c.windowEnd.toISOString(),
        event: "Alert opened",
        detail: `severity=${severity}, z=${c.z.toFixed(2)}, confidence=${confidence}`,
      },
    ];
    const inserted = await query<{ id: number }>(
      `insert into alerts (metric, scope, country, topic, window_start, window_end, baseline, observed, z_score, severity, confidence, explanation, timeline)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb) returning id`,
      [
        c.metric,
        c.scope,
        c.country,
        c.topic,
        c.windowStart,
        c.windowEnd,
        c.baseline,
        c.observed,
        c.z,
        severity,
        confidence,
        explanation,
        JSON.stringify(timeline),
      ],
    );
    created++;
    if (opts.notify !== false && (severity === "high" || severity === "critical")) {
      const id = Number(inserted[0].id);
      await sendTelegram(
        `Deriv Intelligence ALERT [${severity.toUpperCase()}] #${id}\n` +
          `Scope: ${c.scope} (${c.metric})\n` +
          `Observed ${c.observed.toFixed(2)} vs baseline ${c.baseline.toFixed(2)} (z=${c.z.toFixed(2)})\n\n` +
          explanation,
      );
    }
  }
  await resolveAlerts();
  return created;
}

async function resolveAlerts(): Promise<void> {
  const open = await query<{ id: number; metric: string; scope: string; country: string | null; topic: string | null; observed: string; baseline: string; timeline: string }>(
    `select id, metric, scope, country, topic, observed, baseline, timeline
     from alerts where status = 'open' and created_at < now() - interval '4 hours' limit 20`,
  );
  for (const a of open) {
    const filters: { country?: string; topic?: string; from?: string } = {
      from: new Date(Date.now() - 2 * 3600_000).toISOString(),
    };
    if (a.country) filters.country = a.country;
    if (a.topic) filters.topic = a.topic;
    const dim = a.country ? "country" : a.topic ? "topic" : null;
    if (!dim) continue;
    const key = dim === "country" ? `e.location_country` : `t`;
    const unnest = dim === "topic" ? `cross join lateral unnest(e.topics) as t` : "";
    const val = dim === "country" ? a.country : a.topic;
    const rows = await query<{ c: string }>(
      `select count(*)::int as c ${BASE_JOIN} ${unnest}
       where e.is_bot = false and e.sentiment is not null and ${key} = $1
         and i.published_at >= now() - interval '2 hours'`,
      [val],
    );
    const current = Number(rows[0]?.c ?? 0);
    const observed = Number(a.observed);
    if (current <= Math.max(observed / 2, 2)) {
      const timeline = JSON.parse(a.timeline || "[]") as { at: string; event: string; detail: string }[];
      timeline.push({
        at: new Date().toISOString(),
        event: "Normalized",
        detail: `Last 2h volume back to ${current}, alert auto-resolved`,
      });
      await query(`update alerts set status = 'resolved', timeline = $2::jsonb where id = $1`, [
        a.id,
        JSON.stringify(timeline),
      ]);
    }
  }
}
