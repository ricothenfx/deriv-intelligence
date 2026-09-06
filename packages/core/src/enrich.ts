import { z } from "zod";
import { chatText, embed, modelFor, parseJson } from "@deriv-intel/llm";
import { query, withTx } from "./db";
import { botCheck } from "./botfilter";
import { estimateLocation, localHour } from "./location";

export const CLASSIFICATION_BATCH = 10;

const aspectSchema = z.object({
  name: z.string(),
  sentiment: z.enum(["positive", "negative", "neutral", "mixed"]),
});

export const classificationSchema = z.object({
  i: z.number().int(),
  language: z.string().min(2).max(10),
  mentions_brand: z.boolean(),
  brands: z.array(z.string().min(2).max(30)).max(6).default([]),
  sentiment: z.enum(["positive", "negative", "neutral", "mixed"]),
  sentiment_confidence: z.number().min(0).max(1),
  emotion: z.string().nullable().optional(),
  intensity: z.number().min(0).max(1).optional(),
  aspects: z.array(aspectSchema).max(6).default([]),
  topics: z.array(z.string().min(2).max(40)).max(4).default([]),
  journey_stage: z.enum(["signup", "kyc", "deposit", "trading", "withdrawal", "support", "general", "other"]),
});

export type Classification = z.infer<typeof classificationSchema>;

const SYSTEM_PROMPT = `You are a social-listening annotation engine for the trading platform brand "Deriv".
Classify each social post, app review, or web article excerpt about trading/finance.
Rules:
- language: ISO 639-1 code of the dominant language (en, id, ms, vi, th, bn, ur, sw, fil, ru, pt, ar, ...).
- mentions_brand: true only if the text is about the Deriv brand (deriv.app, Binary.com, Deriv Bot, DTrader, Deriv Go, Deriv CTOT count as true; math "derivatives" is false).
- brands: every tracked trading brand this text is about, lowercase, from this list only: {tracked_brands}. Include "deriv" when mentions_brand is true. Empty array if none.
- sentiment: overall sentiment toward the Deriv brand. Use "mixed" only when clearly both positive and negative.
- aspects: distinct aspects mentioned, from this taxonomy: platform, app, withdrawal, deposit, kyc_verification, account, trading_experience, spreads_fees, support, security, regulation, bonuses, stability, payments, platform_performance. Each aspect carries its own sentiment.
- topics: 1-3 short canonical topic tags in English, lowercase snake_case (e.g. withdrawal_delay, app_crash, kyc_pending, good_spreads, account_blocked, scam_accusation, customer_support, deposit_bonus).
- journey_stage: the customer journey stage this text is mainly about: signup, kyc, deposit, trading, withdrawal, support; use "general" for brand-level chatter, "other" if unrelated.
- Slang counts: Indonesian "wd"/"withdraw" = withdrawal, "verif" = verification, "ribet" = cumbersome. Nigerian Pidgin "dem no gree pay" = negative withdrawal.
Return strict JSON {"results":[...]} with exactly one object per input, in input order, using the input index as "i".
Output format contract — every result object MUST have this exact shape:
{"results":[{"i":0,"language":"en","mentions_brand":true,"brands":["deriv"],"sentiment":"negative","sentiment_confidence":0.85,"emotion":"frustration","intensity":0.7,"aspects":[{"name":"withdrawal","sentiment":"negative"},{"name":"support","sentiment":"negative"}],"topics":["withdrawal_delay"],"journey_stage":"withdrawal"}]}
- "sentiment_confidence" is a REQUIRED number between 0 and 1 (never omit it).
- "aspects" MUST be an array of {"name":"...","sentiment":"..."} objects, never an object map.
- "brands" is a REQUIRED array of lowercase strings (may be empty).
- "emotion" and "intensity" are optional; all other fields are required.
- Each user item may carry "found_via_query": the search query that surfaced it. It is a WEAK hint only — if the text itself shows no sign of any tracked brand, keep mentions_brand=false and brands=[] even if the query mentions a brand. But if the text is clearly about trading and plausibly about the queried brand (e.g. a broker review/tutorial without naming it), prefer tagging that brand.`;

export interface ClassifyInput {
  i: number;
  source: string;
  title: string | null;
  text: string;
  found_via_query?: string | null;
}

function normalizeResult(raw: unknown, fallbackSentiment: string): Record<string, unknown> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  if (!Array.isArray(r.aspects)) {
    if (r.aspects && typeof r.aspects === "object") {
      r.aspects = Object.entries(r.aspects as Record<string, unknown>).map(([name, sentiment]) =>
        typeof sentiment === "string" ? { name, sentiment: sentiment.toLowerCase().trim() } : { name, sentiment: fallbackSentiment },
      );
    } else {
      r.aspects = [];
    }
  } else {
    r.aspects = (r.aspects as unknown[]).map((a) => {
      if (typeof a === "string") return { name: a, sentiment: fallbackSentiment };
      if (a && typeof a === "object") {
        const o = a as Record<string, unknown>;
        return {
          name: String(o.name ?? o.aspect ?? "unknown"),
          sentiment: String(o.sentiment ?? fallbackSentiment).toLowerCase().trim(),
        };
      }
      return { name: "unknown", sentiment: fallbackSentiment };
    });
  }
  r.aspects = (r.aspects as { name: string; sentiment: string }[]).slice(0, 6);
  if (typeof r.sentiment_confidence !== "number" || Number.isNaN(r.sentiment_confidence)) r.sentiment_confidence = 0.5;
  const conf = r.sentiment_confidence as number;
  if (conf < 0) r.sentiment_confidence = 0;
  if (conf > 1) r.sentiment_confidence = 1;
  if (typeof r.mentions_brand === "string") r.mentions_brand = r.mentions_brand === "true";
  if (Array.isArray(r.topics)) {
    r.topics = (r.topics as unknown[])
      .filter((t) => typeof t === "string" && t.trim().length >= 2)
      .map((t) => (t as string).trim().slice(0, 40))
      .slice(0, 4);
  }
  if (Array.isArray(r.brands)) {
    r.brands = [...new Set(
      (r.brands as unknown[])
        .filter((b): b is string => typeof b === "string" && b.trim().length >= 2)
        .map((b) => b.trim().toLowerCase().slice(0, 30)),
    )].slice(0, 6);
  } else {
    r.brands = r.mentions_brand === true ? ["deriv"] : [];
  }
  if (typeof r.language === "string") r.language = r.language.trim().slice(0, 10);
  return r;
}

const FALLBACK_BRANDS = ["deriv", "exness", "iq option", "octafx"];

function trackedBrands(): string[] {
  const raw = (process.env.TRACKED_BRANDS || FALLBACK_BRANDS.join(","))
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return raw.length ? raw : FALLBACK_BRANDS;
}

export async function classifyTexts(inputs: ClassifyInput[]): Promise<(Classification | undefined)[]> {
  const brand = process.env.TARGET_BRAND || "Deriv";
  const out: (Classification | undefined)[] = new Array(inputs.length).fill(undefined);
  const text = await chatText({
    tier: "cheap",
    purpose: "enrich",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT.replaceAll("{tracked_brands}", trackedBrands().join(", ")),
      },
      { role: "user", content: `Brand: ${brand}\nClassify these ${inputs.length} items:\n${JSON.stringify(inputs)}` },
    ],
    json: true,
    temperature: 0,
    maxTokens: 4000,
  });
  const parsed = parseJson<{ results: unknown[] }>(text);
  for (const raw of parsed.results ?? []) {
    const fallback = typeof (raw as { sentiment?: unknown })?.sentiment === "string"
      ? String((raw as { sentiment: string }).sentiment).toLowerCase().trim()
      : "neutral";
    const candidate = normalizeResult(raw, ["positive", "negative", "neutral", "mixed"].includes(fallback) ? fallback : "neutral");
    if (!candidate) continue;
    const r = classificationSchema.safeParse(candidate);
    if (r.success && r.data.i >= 0 && r.data.i < inputs.length) out[r.data.i] = r.data;
  }
  return out;
}

interface ItemRow {
  id: number;
  source: string;
  title: string | null;
  content: string;
  author: string | null;
  published_at: Date;
  metadata: Record<string, unknown>;
}

function sentimentScore(sentiment: string, confidence: number, intensity: number): number {
  const base = sentiment === "positive" ? 1 : sentiment === "negative" ? -1 : 0;
  return Number((base * confidence * (0.5 + 0.5 * (intensity ?? 0.5))).toFixed(3));
}

async function insertEnrichment(vals: {
  item_id: number;
  is_bot: boolean;
  bot_reason?: string | null;
  c?: Classification;
  country?: string | null;
  confidence?: number | null;
  hour?: number | null;
  model?: string | null;
}): Promise<void> {
  const c = vals.c;
  await withTx(async (cl) => {
    await cl.query(
      `insert into item_enrichments
        (item_id, sentiment, sentiment_score, sentiment_confidence, emotion, intensity, aspects, topics, journey_stage, language, location_country, location_confidence, local_hour, is_bot, bot_reason, llm_model, mentions_brand, brands)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::text[],$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::text[])
       on conflict (item_id) do nothing`,
      [
        vals.item_id,
        c?.sentiment ?? null,
        c ? sentimentScore(c.sentiment, c.sentiment_confidence, c.intensity ?? 0.5) : null,
        c?.sentiment_confidence ?? null,
        c?.emotion ?? null,
        c?.intensity ?? null,
        JSON.stringify(c?.aspects ?? []),
        c?.topics ?? [],
        c?.journey_stage ?? null,
        c?.language ?? null,
        vals.country ?? null,
        vals.confidence ?? null,
        vals.hour ?? null,
        vals.is_bot,
        vals.bot_reason ?? null,
        vals.model ?? null,
        c?.mentions_brand ?? null,
        c?.brands ?? (c?.mentions_brand ? ["deriv"] : []),
      ],
    );
  });
}

export interface EnrichmentSummary {
  enriched: number;
  bots: number;
  skipped: number;
}

export async function runEnrichment(itemIds: number[]): Promise<EnrichmentSummary> {
  if (!itemIds.length) return { enriched: 0, bots: 0, skipped: 0 };
  const rows = await query<ItemRow>(
    `select i.id, i.source, i.title, i.content, i.author, i.published_at, i.metadata
     from items i
     left join item_enrichments e on e.item_id = i.id
     where i.id = any($1::bigint[]) and e.item_id is null`,
    [itemIds],
  );

  let enriched = 0;
  let bots = 0;
  const pending: ItemRow[] = [];
  for (const r of rows) {
    const check = botCheck({ content: r.content });
    if (check.bot) {
      await insertEnrichment({ item_id: r.id, is_bot: true, bot_reason: check.reason });
      bots++;
    } else {
      pending.push(r);
    }
  }

  const model = modelFor("cheap");
  const toEmbed: { id: number; text: string }[] = [];

  for (let i = 0; i < pending.length; i += CLASSIFICATION_BATCH) {
    const batch = pending.slice(i, i + CLASSIFICATION_BATCH);
    const classified = new Map<number, Classification>();
    try {
      const results = await classifyTexts(
        batch.map((r, j) => ({
          i: j,
          source: r.source,
          title: r.title,
          text: r.content.slice(0, 1200),
          found_via_query: typeof r.metadata?.query === "string" ? r.metadata.query : null,
        })),
      );
      batch.forEach((r, j) => {
        if (results[j]) classified.set(r.id, results[j]!);
      });
    } catch (e) {
      console.error("enrich batch failed:", e);
    }
    for (const [j, r] of batch.entries()) {
      if (!classified.has(r.id)) {
        try {
          const single = await classifyTexts([
            {
              i: 0,
              source: r.source,
              title: r.title,
              text: r.content.slice(0, 1200),
              found_via_query: typeof r.metadata?.query === "string" ? r.metadata.query : null,
            },
          ]);
          if (single[0]) classified.set(r.id, single[0]!);
        } catch (e) {
          console.error("enrich item failed:", r.id, e);
        }
      }
      const c = classified.get(r.id);
      if (!c) continue;
      const loc = estimateLocation({ source: r.source, metadata: r.metadata, language: c.language });
      await insertEnrichment({
        item_id: r.id,
        is_bot: false,
        c,
        country: loc.country,
        confidence: loc.confidence,
        hour: localHour(r.published_at, loc.country),
        model,
      });
      toEmbed.push({ id: r.id, text: `${r.title ? r.title + ". " : ""}${r.content}`.slice(0, 4000) });
      if (r.author) {
        await withTx(async (cl) => {
          await cl.query(
            `insert into authors (source, source_author_id, username)
             values ($1, $2, $2)
             on conflict (source, source_author_id) do update set last_seen = now()`,
            [r.source, r.author],
          );
        });
      }
      enriched++;
    }
  }

  for (let i = 0; i < toEmbed.length; i += 64) {
    const chunk = toEmbed.slice(i, i + 64);
    try {
      const vectors = await embed(chunk.map((x) => x.text), "embedding");
      await withTx(async (cl) => {
        for (let k = 0; k < chunk.length; k++) {
          if (!vectors[k]) continue;
          await cl.query(
            `insert into item_embeddings (item_id, embedding) values ($1, $2::vector)
             on conflict (item_id) do nothing`,
            [chunk[k].id, JSON.stringify(vectors[k])],
          );
        }
      });
    } catch (e) {
      console.warn("embedding skipped:", e instanceof Error ? e.message : e);
    }
  }

  return { enriched, bots, skipped: itemIds.length - rows.length };
}
