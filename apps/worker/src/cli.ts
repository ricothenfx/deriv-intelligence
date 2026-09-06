import { config } from "dotenv";
import { join } from "path";

config({ path: join(__dirname, "../../../.env") });
import { setUsageSink } from "@deriv-intel/llm";
import {
  closePool,
  detectAnomalies,
  generateWeeklyReport,
  ingestItems,
  runEnrichment,
  saveQueryState,
  withTx,
} from "@deriv-intel/core";
import { CONNECTORS, type SourceName } from "@deriv-intel/connectors";

setUsageSink((u) =>
  withTx(async (c) => {
    await c.query(
      `insert into llm_usage (purpose, model, source, input_tokens, output_tokens, cost_usd)
       values ($1, $2, $3, $4, $5, $6)`,
      [u.purpose, u.model, u.source, u.inputTokens, u.outputTokens, u.costUsd],
    );
  }).catch(() => {}),
);

const SOURCES: SourceName[] = ["reddit", "youtube", "gplay", "tavily"];

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      flags[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "true";
      if (flags[args[i].slice(2)] === "true" || args[i + 1]?.startsWith("--")) continue;
      i++;
    }
  }
  return flags;
}

async function enrichAll(ids: number[]): Promise<void> {
  let done = 0;
  let bots = 0;
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const out = await runEnrichment(chunk);
    done += out.enriched + out.bots;
    bots += out.bots;
    process.stdout.write(`\r  enriched ${done}/${ids.length} (bots ${bots})`);
  }
  console.log();
}

async function runFetch(source: SourceName): Promise<void> {
  const { loadQueryState } = await import("@deriv-intel/core");
  const state = await loadQueryState(source);
  const result = await CONNECTORS[source]({ cursor: (state?.cursor as Record<string, unknown>) ?? null });
  const inserted = await ingestItems(result.items);
  await saveQueryState(source, result.cursor, result.metrics);
  console.log(`${source}: fetched=${result.items.length} new=${inserted.length}`);
  await enrichAll(inserted.map((x) => x.id));
}

async function runBackfill(source: SourceName, days: number): Promise<void> {
  if (source === "gplay" || source === "tavily") {
    console.log(`${source}: no historical paging supported, running one wide fetch`);
    const lookback = source === "gplay" ? Math.max(days, 365) : days;
    const from = new Date(Date.now() - lookback * 86400_000);
    const result = await CONNECTORS[source]({ window: { from }, ...(source === "gplay" ? { limit: 500 } : {}) });
    const inserted = await ingestItems(result.items);
    console.log(`${source}: fetched=${result.items.length} new=${inserted.length}`);
    await enrichAll(inserted.map((x) => x.id));
    return;
  }

  const stepMs = (source === "youtube" ? 30 : 3) * 86400_000;
  const startMs = Date.now() - days * 86400_000;
  for (let to = Date.now(); to > startMs; to -= stepMs) {
    const from = Math.max(to - stepMs, startMs);
    const fromD = new Date(from);
    const toD = new Date(to);
    console.log(`window ${fromD.toISOString().slice(0, 10)} .. ${toD.toISOString().slice(0, 10)}`);
    const result = await CONNECTORS[source]({ window: { from: fromD, to: toD } });
    const inserted = await ingestItems(result.items);
    console.log(`  fetched=${result.items.length} new=${inserted.length}`);
    await enrichAll(inserted.map((x) => x.id));
  }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  switch (cmd) {
    case "fetch": {
      const source = (rest[0] as SourceName) ?? "reddit";
      if (!SOURCES.includes(source)) throw new Error(`unknown source: ${source}`);
      await runFetch(source);
      break;
    }
    case "backfill": {
      const source = (flags.source as SourceName) ?? "reddit";
      const days = Math.min(Number(flags.days ?? 30), 90);
      if (!SOURCES.includes(source)) throw new Error(`unknown source: ${source}`);
      console.log(`backfill ${source} for ${days} days`);
      await runBackfill(source, days);
      break;
    }
    case "report": {
      const out = await generateWeeklyReport({ notify: flags.notify !== "false" });
      console.log(`report #${out.id} written: ${out.filePath}`);
      console.log(out.summary);
      break;
    }
    case "anomaly": {
      const created = await detectAnomalies({ notify: flags.notify !== "false" });
      console.log(`anomaly detection done, new alerts: ${created}`);
      break;
    }
    case "enrich-pending": {
      const { query } = await import("@deriv-intel/core");
      const rows = await query<{ id: number; source: string }>(
        `select i.id, i.source from items i
         left join item_enrichments e on e.item_id = i.id
         where e.item_id is null
         order by i.id desc limit ${Math.min(Number(flags.limit ?? 2000), 10000)}`,
      );
      console.log(`pending enrichment: ${rows.length} items`);
      if (rows.length) await enrichAll(rows.map((r) => r.id));
      break;
    }
    case "faq": {
      const { generateFaqs } = await import("@deriv-intel/core");
      const out = await generateFaqs(Number(flags.max ?? 12));
      console.log(`faq generated: ${out.created}`);
      break;
    }
    default:
      console.log(`usage:
  tsx src/cli.ts fetch <reddit|youtube|gplay|tavily>
  tsx src/cli.ts backfill --source <reddit|youtube|gplay|tavily> --days 30
  tsx src/cli.ts report [--notify false]
  tsx src/cli.ts anomaly [--notify false]
  tsx src/cli.ts enrich-pending [--limit 2000]
  tsx src/cli.ts faq [--max 12]`);
      process.exit(cmd ? 1 : 0);
  }
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await closePool();
    process.exit(1);
  });
