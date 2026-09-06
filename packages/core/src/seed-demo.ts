import "./env";
import { runMigrations } from "./migrate";
import { withTx, query, closePool } from "./db";
import { localHour } from "./location";
import { contentHash } from "./normalize";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260905);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const COUNTRY_WEIGHTS: [string, number][] = [
  ["NG", 0.16], ["ID", 0.15], ["IN", 0.1], ["BR", 0.08], ["PH", 0.07], ["ZA", 0.06],
  ["MY", 0.06], ["KE", 0.06], ["US", 0.06], ["GB", 0.05], ["VN", 0.05], ["TH", 0.04],
  ["PK", 0.03], ["BD", 0.03],
];

const LANG: Record<string, string> = {
  NG: "en", ID: "id", IN: "en", BR: "pt", PH: "en", ZA: "en", MY: "ms", KE: "en",
  US: "en", GB: "en", VN: "vi", TH: "th", PK: "ur", BD: "bn",
};

interface Template {
  stage: string;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  weight: number;
  aspects: { name: string; sentiment: string }[];
  topics: string[];
  text: { en?: string[]; id?: string[]; generic?: string[] };
}

const TEMPLATES: Template[] = [
  { stage: "withdrawal", sentiment: "negative", weight: 3, aspects: [{ name: "withdrawal", sentiment: "negative" }], topics: ["withdrawal_delay"], text: { en: ["Withdrawal pending for {d} days now, support keeps saying wait", "Haven't received my payout, bank transfer stuck since {d} days", "Dem no gree pay, withdrawal stuck since monday"], id: ["Wd udah {d} hari belum masuk juga, cs cuma bilang tunggu", "Penarikan ditahan tanpa alasan jelas udah {d} hari", "Dana belum masuk setelah wd {d} hari lalu, tolong dicek"] } },
  { stage: "withdrawal", sentiment: "positive", weight: 1, aspects: [{ name: "withdrawal", sentiment: "positive" }], topics: ["fast_withdrawal"], text: { generic: ["Withdrawal via bank transfer arrived in 2 hours. Fast and reliable", "Wd masuk dalam beberapa jam, mantap"] } },
  { stage: "kyc", sentiment: "negative", weight: 2, aspects: [{ name: "kyc_verification", sentiment: "negative" }], topics: ["kyc_pending"], text: { en: ["KYC verification stuck for {d} days, documents all submitted"], id: ["Verif KYC udah {d} minggu, dokumen lengkap tapi gak ada kabar", "KYC ditolak terus padahal dokumen lengkap"] } },
  { stage: "kyc", sentiment: "positive", weight: 1, aspects: [{ name: "kyc_verification", sentiment: "positive" }], topics: ["smooth_signup"], text: { generic: ["Account verified in one day, smooth process", "Verif cepat, langsung approve dalam sehari"] } },
  { stage: "deposit", sentiment: "negative", weight: 1.5, aspects: [{ name: "deposit", sentiment: "negative" }], topics: ["deposit_missing"], text: { en: ["Deposit failed, money deducted but not credited for {d} days", "Deposit via bank transfer missing, no response from support"], id: ["Deposit gagal tapi saldo terpotong, sudah {d} hari"] } },
  { stage: "deposit", sentiment: "positive", weight: 1, aspects: [{ name: "deposit", sentiment: "positive" }, { name: "bonuses", sentiment: "positive" }], topics: ["deposit_bonus"], text: { generic: ["Deposit bonus 100% worked fine, instant", "Deposit instan, bonus langsung masuk"] } },
  { stage: "trading", sentiment: "negative", weight: 2, aspects: [{ name: "app", sentiment: "negative" }, { name: "stability", sentiment: "negative" }], topics: ["app_crash"], text: { en: ["App keeps crashing when I open charts on Android", "Platform freeze saat market volatile, order reject terus"], id: ["App crash saat buka chart, tidak bisa dipakai"] } },
  { stage: "trading", sentiment: "positive", weight: 1.5, aspects: [{ name: "spreads_fees", sentiment: "positive" }, { name: "trading_experience", sentiment: "positive" }], topics: ["good_spreads"], text: { en: ["Tight spreads and fast execution on synthetic indices", "Deriv Bot automation is powerful, backtesting saves time"], id: ["Spread rendah dan eksekusi cepat, cocok scalping"] } },
  { stage: "support", sentiment: "negative", weight: 1.5, aspects: [{ name: "support", sentiment: "negative" }], topics: ["customer_support"], text: { en: ["Support doesn't reply for days, ticket ignored", "Live chat useless, generic answers only"], id: ["Cs lambat banget jawabnya, tiket diabaikan"] } },
  { stage: "support", sentiment: "positive", weight: 1, aspects: [{ name: "support", sentiment: "positive" }], topics: ["customer_support"], text: { generic: ["Support replied within 5 minutes and solved my account issue", "Cs fast response, masalah beres dalam hitungan menit"] } },
  { stage: "signup", sentiment: "positive", weight: 0.8, aspects: [{ name: "account", sentiment: "positive" }], topics: ["smooth_signup"], text: { generic: ["Signup process was smooth, no issues at all", "Daftar gampang, 10 menit beres"] } },
  { stage: "support", sentiment: "negative", weight: 1, aspects: [{ name: "account", sentiment: "negative" }], topics: ["account_blocked"], text: { en: ["Froze my account after I made profit", "Account blocked without clear reason"], id: ["Akun saya diblokir tanpa alasan jelas, dana tidak bisa ditarik"] } },
  { stage: "general", sentiment: "negative", weight: 1, aspects: [{ name: "security", sentiment: "negative" }], topics: ["scam_accusation"], text: { generic: ["This broker is a scam, avoid at all cost", "Broker penipuan, jangan pakai"] } },
  { stage: "general", sentiment: "positive", weight: 1, aspects: [{ name: "platform", sentiment: "positive" }], topics: ["brand_love"], text: { generic: ["Best broker I've used, transparent fees", "Broker terbaik yang pernah saya pakai"] } },
  { stage: "general", sentiment: "mixed", weight: 0.8, aspects: [{ name: "platform", sentiment: "positive" }, { name: "withdrawal", sentiment: "negative" }], topics: ["good_spreads", "withdrawal_delay"], text: { id: ["Platform bagus spread rendah, tapi wd lambat"] } },
];

const SUFFIXES = ["", "", "", " Please fix.", " Anyone same?", " Help please.", " Thanks.", " Update: still nothing.", " So far so good.", " Not recommended.", " Highly recommend.", " Rated {r} star."];

function weightedTemplate(): Template {
  const total = TEMPLATES.reduce((s, t) => s + t.weight, 0);
  let r = rand() * total;
  for (const t of TEMPLATES) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return TEMPLATES[0];
}

function pickCountry(): string {
  let r = rand();
  for (const [c, w] of COUNTRY_WEIGHTS) {
    r -= w;
    if (r <= 0) return c;
  }
  return "US";
}

function randomEmbedding(dim: number): number[] {
  const v = Array.from({ length: dim }, () => rand() * 2 - 1);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

async function main(): Promise<void> {
  await runMigrations();

  const existing = await query<{ c: string }>(`select count(*)::int as c from items`);
  if (Number(existing[0]?.c ?? 0) > 0) {
    console.log(`items table already has ${existing[0]?.c} rows, skipping seed`);
    return;
  }

  const dim = Number(process.env.EMBEDDING_DIM || 1536);
  const now = Date.now();
  const DAYS = 60;
  const TOTAL = 650;
  const CRISIS_EXTRA = 110;

  interface Seeded {
    source: string;
    sourceId: string;
    url: string | null;
    title: string | null;
    content: string;
    author: string | null;
    published: Date;
    engagement: Record<string, unknown>;
    metadata: Record<string, unknown>;
    country: string;
    lang: string;
    template: Template;
    confidence: number;
    intensity: number;
  }

  const seeds: Seeded[] = [];

  const makeItem = (crisis: boolean, i: number): Seeded => {
    const country = crisis ? (rand() < 0.85 ? "NG" : "GH") : pickCountry();
    const lang = LANG[country] ?? "en";
    const template = crisis
      ? TEMPLATES[0]
      : weightedTemplate();
    const variants =
      template.text[lang === "id" ? "id" : lang === "en" ? "en" : "generic"] ??
      template.text.generic ??
      template.text.en ??
      [""];
    const d = randInt(2, 7);
    const suffix = pick(SUFFIXES).replace("{r}", String(randInt(1, 2)));
    const content = `${pick(variants).replace("{d}", String(d))}${suffix}`;
    const ageDays = crisis ? rand() * 1.5 : rand() * DAYS;
    const hourBias = rand() < 0.65 ? randInt(7, 23) : randInt(0, 6);
    const utcHour = (hourBias - Math.round(randInt(0, 3)) + 24) % 24;
    const published = new Date(now - ageDays * 86400_000 - randInt(0, 3599) * 1000 - utcHour * 0);
    published.setUTCHours(utcHour, randInt(0, 59), 0, 0);
    const sourceRoll = rand();
    const source = sourceRoll < 0.4 ? "gplay" : sourceRoll < 0.75 ? "reddit" : sourceRoll < 0.9 ? "youtube" : "tavily";
    const author = `${source}_user_${randInt(1000, 99999)}`;
    const rating =
      template.sentiment === "positive" ? randInt(4, 5) : template.sentiment === "negative" ? randInt(1, 2) : 3;
    const engagement: Record<string, unknown> =
      source === "reddit"
        ? { score: randInt(1, 240), comments: randInt(0, 60) }
        : source === "gplay"
          ? { score: rating, thumbsUp: randInt(0, 40) }
          : source === "youtube"
            ? { likes: randInt(0, 90) }
            : { score: 1 };
    const metadata: Record<string, unknown> =
      source === "gplay"
        ? { country, rating, appVersion: `1.${randInt(20, 34)}.${randInt(0, 9)}`, kind: "app_review" }
        : source === "reddit"
          ? { subreddit: country === "ID" ? "indotrader" : country === "NG" ? "nigeriaforex" : "Forex", kind: "post" }
          : { kind: source === "youtube" ? "comment" : "web", videoId: `vid${randInt(10000, 99999)}` };
    return {
      source,
      sourceId: `seed-${source}-${i}-${randInt(100000, 999999)}`,
      url: source === "reddit" ? "https://reddit.com/r/Forex/comments/demo" : null,
      title: null,
      content,
      author,
      published,
      engagement,
      metadata,
      country,
      lang,
      template,
      confidence: 0.6 + rand() * 0.35,
      intensity: 0.4 + rand() * 0.5,
    };
  };

  for (let i = 0; i < TOTAL; i++) seeds.push(makeItem(false, i));
  for (let i = 0; i < CRISIS_EXTRA; i++) seeds.push(makeItem(true, 10000 + i));

  let inserted = 0;
  const CHUNK = 100;
  for (let i = 0; i < seeds.length; i += CHUNK) {
    const chunk = seeds.slice(i, i + CHUNK);
    await withTx(async (c) => {
      for (const s of chunk) {
        const hour = localHour(s.published, s.country);
        const base = s.template.sentiment === "positive" ? 1 : s.template.sentiment === "negative" ? -1 : 0;
        const score = Number((base * s.confidence * (0.5 + 0.5 * s.intensity)).toFixed(3));
        const res = await c.query(
          `insert into items (source, source_id, url, title, content, author, language, published_at, engagement, metadata, content_hash)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11) on conflict do nothing returning id`,
          [
            s.source, s.sourceId, s.url, s.title, s.content, s.author, s.lang, s.published,
            JSON.stringify(s.engagement), JSON.stringify(s.metadata), contentHash(s.source, s.content),
          ],
        );
        const id = res.rows[0]?.id;
        if (!id) continue;
        inserted++;
        await c.query(
          `insert into item_enrichments
            (item_id, sentiment, sentiment_score, sentiment_confidence, emotion, intensity, aspects, topics, journey_stage, language, location_country, location_confidence, local_hour, is_bot, llm_model, mentions_brand, brands)
           values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::text[],$9,$10,$11,$12,$13,false,'seed',true,'{deriv}')
           on conflict do nothing`,
          [
            id, s.template.sentiment, score, Number(s.confidence.toFixed(2)),
            s.template.sentiment === "negative" ? "frustration" : "satisfaction",
            Number(s.intensity.toFixed(2)),
            JSON.stringify(s.template.aspects), s.template.topics, s.template.stage,
            s.lang, s.country, s.source === "gplay" ? 0.95 : 0.62, hour,
          ],
        );
        await c.query(
          `insert into item_embeddings (item_id, embedding) values ($1, $2::vector) on conflict do nothing`,
          [id, JSON.stringify(randomEmbedding(dim))],
        );
      }
    });
    process.stdout.write(`\rseeded ${Math.min(i + CHUNK, seeds.length)}/${seeds.length}`);
  }
  console.log(`\nitems inserted: ${inserted}`);

  await withTx(async (c) => {
    const crisisStart = new Date(now - 36 * 3600_000).toISOString();
    await c.query(
      `insert into alerts (metric, scope, country, topic, window_start, window_end, baseline, observed, z_score, severity, confidence, explanation, status, timeline)
       values ('volume', 'country:NG', 'NG', 'withdrawal_delay', $1, now(), 6.4, 71, 5.8, 'critical', 0.92,
        'Spike of withdrawal complaints from Nigeria within the last 36 hours. Sample posts consistently mention pending bank transfers and unresponsive support, suggesting a payout processing issue affecting Nigerian payment channels.',
        'open', $2::jsonb)`,
      [
        crisisStart,
        JSON.stringify([
          { at: crisisStart, event: "Anomaly detected", detail: "Volume observed 71.00 vs baseline 6.40 (z=5.80)" },
          { at: new Date(now - 20 * 3600_000).toISOString(), event: "Peak", detail: "38 mentions in 1 hour, mostly withdrawal_delay from NG" },
          { at: new Date(now - 6 * 3600_000).toISOString(), event: "Monitoring", detail: "Rate still 4x baseline, alert remains open" },
        ]),
      ],
    );
    await c.query(
      `insert into alerts (metric, scope, country, topic, window_start, window_end, baseline, observed, z_score, severity, confidence, explanation, status, timeline)
       values ('sentiment', 'country:ID', 'ID', null, now() - interval '24 hours', now(), -0.05, -0.41, -3.1, 'high', 0.81,
        'Weighted sentiment in Indonesia dropped sharply in the last 24 hours. Negative posts cluster around KYC document rejections and pending verifications.',
        'resolved', $1::jsonb)`,
      [
        JSON.stringify([
          { at: new Date(now - 24 * 3600_000).toISOString(), event: "Anomaly detected", detail: "Weighted sentiment -0.41 vs baseline -0.05 (z=-3.10)" },
          { at: new Date(now - 9 * 3600_000).toISOString(), event: "Normalized", detail: "Sentiment recovered to -0.08, alert auto-resolved" },
        ]),
      ],
    );
  });

  await withTx(async (c) => {
    for (let day = 13; day >= 0; day--) {
      const calls = randInt(20, 70);
      for (let k = 0; k < calls; k++) {
        const purpose = pick(["enrich", "enrich", "enrich", "embedding", "chat", "anomaly", "report"]);
        const inTok = randInt(700, 3200);
        const outTok = randInt(200, 1400);
        const cost = Number(((inTok / 1e6) * 0.15 + (outTok / 1e6) * 0.6).toFixed(6));
        await c.query(
          `insert into llm_usage (created_at, purpose, model, source, input_tokens, output_tokens, cost_usd)
           values (now() - ($1 || ' days')::interval - ($2 || ' minutes')::interval, $3, 'gpt-4o-mini', 'seed', $4, $5, $6)`,
          [day, randInt(0, 1400), purpose, inTok, outTok, cost],
        );
      }
    }
  });

  console.log("seed complete: items, enrichments, embeddings, 2 alerts, llm_usage");
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await closePool();
    process.exit(1);
  });
