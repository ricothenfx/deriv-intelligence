import "../env";
import { readFileSync } from "fs";
import { join } from "path";
import { classifyTexts } from "../enrich";

interface GoldenAspect {
  name: string;
  sentiment: string;
}

interface GoldenSample {
  id: string;
  text: string;
  labels: {
    language: string;
    sentiment: string;
    journey_stage: string;
    aspects: GoldenAspect[];
    topics: string[];
    mentions_brand?: boolean;
  };
}

async function main(): Promise<void> {
  const file = process.argv[2] || join(__dirname, "golden.jsonl");
  const samples: GoldenSample[] = readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));

  const results = await classifyTexts(
    samples.map((s, i) => ({ i, source: "reddit", title: null, text: s.text })),
  );

  let sent = 0;
  let stage = 0;
  let lang = 0;
  let brandOk = 0;
  let brandN = 0;
  let aspectHits = 0;
  let aspectPred = 0;
  let aspectGold = 0;
  const misses: string[] = [];

  samples.forEach((s, i) => {
    const r = results[i];
    if (!r) {
      misses.push(`${s.id}: no result`);
      return;
    }
    if (r.sentiment === s.labels.sentiment) sent++;
    else misses.push(`${s.id}: sentiment=${r.sentiment} expected=${s.labels.sentiment}`);
    if (r.journey_stage === s.labels.journey_stage) stage++;
    else misses.push(`${s.id}: stage=${r.journey_stage} expected=${s.labels.journey_stage}`);
    if (r.language === s.labels.language) lang++;
    else misses.push(`${s.id}: language=${r.language} expected=${s.labels.language}`);
    if (typeof s.labels.mentions_brand === "boolean") {
      brandN++;
      if (r.mentions_brand === s.labels.mentions_brand) brandOk++;
      else misses.push(`${s.id}: mentions_brand=${r.mentions_brand} expected=${s.labels.mentions_brand}`);
    }
    const gold = new Set(s.labels.aspects.map((a) => `${a.name}:${a.sentiment}`));
    const pred = new Set(r.aspects.map((a) => `${a.name}:${a.sentiment}`));
    aspectGold += gold.size;
    aspectPred += pred.size;
    for (const p of pred) if (gold.has(p)) aspectHits++;
  });

  const n = samples.length;
  const pct = (x: number) => `${((100 * x) / Math.max(n, 1)).toFixed(1)}%`;
  console.log(`Golden dataset eval — ${n} samples`);
  console.log(`sentiment accuracy : ${sent}/${n} (${pct(sent)})`);
  console.log(`journey accuracy  : ${stage}/${n} (${pct(stage)})`);
  console.log(`language accuracy : ${lang}/${n} (${pct(lang)})`);
  if (brandN) console.log(`brand detection   : ${brandOk}/${brandN}`);
  console.log(`aspect precision  : ${(aspectHits / Math.max(aspectPred, 1)).toFixed(2)} (${aspectHits}/${aspectPred})`);
  console.log(`aspect recall     : ${(aspectHits / Math.max(aspectGold, 1)).toFixed(2)} (${aspectHits}/${aspectGold})`);
  if (misses.length) {
    console.log("\nMisses:");
    for (const m of misses) console.log(" -", m);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
