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
import { CONNECTORS, type FetchOptions, type SourceName } from "@deriv-intel/connectors";

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

async function fetchOpts(source: SourceName, window?: { from: Date; to?: Date }): Promise<FetchOptions> {
  const { loadQueryState, getKeywords } = await import("@deriv-intel/core");
  const state = await loadQueryState(source);
  const queries = await getKeywords(source);
  return {
    cursor: (state?.cursor as Record<string, unknown>) ?? null,
    ...(queries.length ? { queries } : {}),
    ...(window ? { window: { from: window.from, ...(window.to ? { to: window.to } : {}) } } : {}),
  };
}

async function runFetch(source: SourceName): Promise<void> {
  const result = await CONNECTORS[source](await fetchOpts(source));
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
    const result = await CONNECTORS[source]({ ...(await fetchOpts(source)), window: { from }, ...(source === "gplay" ? { limit: 500 } : {}) });
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
    const result = await CONNECTORS[source](await fetchOpts(source, { from: fromD, to: toD }));
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
    case "fix-links": {
      const { query } = await import("@deriv-intel/core");
      const comments = await query<{ id: number }>(
        `update items set url = url || '&lc=' || source_id
         where source = 'youtube' and metadata->>'kind' = 'comment'
           and source_id like 'Ug%' and url like 'https://www.youtube.com/watch%'
           and url not like '%lc=%'
         returning id`,
      );
      console.log(`youtube comment deep-links updated: ${comments.length}`);

      const videos = await query<{ id: number; video_id: string }>(
        `select id, metadata->>'videoId' as video_id from items
         where source = 'youtube' and metadata->>'kind' = 'video'
           and metadata->>'videoId' is not null and metadata->>'channelId' is null`,
      );
      console.log(`videos missing channelId: ${videos.length}`);
      const key = process.env.YOUTUBE_API_KEY;
      if (videos.length && key) {
        let fixed = 0;
        for (let i = 0; i < videos.length; i += 50) {
          const chunk = videos.slice(i, i + 50);
          const ids = chunk.map((v) => v.video_id).join(",");
          const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids}&key=${key}`);
          if (!res.ok) {
            console.log(`videos api failed: ${res.status}, stopping`);
            break;
          }
          const json = (await res.json()) as { items?: { id: string; snippet?: { channelId?: string } }[] };
          const byId = new Map((json.items ?? []).map((v) => [v.id, v.snippet?.channelId ?? null]));
          for (const v of chunk) {
            const channelId = byId.get(v.video_id);
            if (!channelId) continue;
            await query(`update items set metadata = metadata || jsonb_build_object('channelId', $2::text) where id = $1`, [v.id, channelId]);
            fixed++;
          }
          await new Promise((r) => setTimeout(r, 300));
        }
        console.log(`channelId backfilled: ${fixed}`);
      } else if (videos.length) {
        console.log("YOUTUBE_API_KEY not set, skipping channelId backfill");
      }

      const subsRows = await query<{ id: number; channel_id: string }>(
        `select id, metadata->>'channelId' as channel_id from items
         where source = 'youtube' and metadata->>'kind' = 'video'
           and metadata->>'channelId' is not null
           and metadata->>'channelSubs' is null`,
      );
      console.log(`videos missing channelSubs: ${subsRows.length}`);
      if (!subsRows.length) break;
      if (!key) {
        console.log("YOUTUBE_API_KEY not set, skipping channelSubs backfill");
        break;
      }
      const uniqueChannels = [...new Set(subsRows.map((r) => r.channel_id))];
      const subsMap = new Map<string, number>();
      for (let i = 0; i < uniqueChannels.length; i += 50) {
        const chunk = uniqueChannels.slice(i, i + 50);
        const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${chunk.join(",")}&key=${key}`);
        if (!res.ok) {
          console.log(`channels api failed: ${res.status}, stopping`);
          break;
        }
        const json = (await res.json()) as { items?: { id: string; statistics?: { subscriberCount?: string } }[] };
        for (const ch of json.items ?? []) {
          const subs = Number(ch.statistics?.subscriberCount);
          if (ch.id && Number.isFinite(subs)) subsMap.set(ch.id, subs);
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      let subsFixed = 0;
      for (const row of subsRows) {
        const subs = subsMap.get(row.channel_id);
        if (subs == null) continue;
        await query(`update items set metadata = metadata || jsonb_build_object('channelSubs', $2::bigint) where id = $1`, [row.id, subs]);
        subsFixed++;
      }
      console.log(`channelSubs backfilled: ${subsFixed} of ${subsRows.length}`);
      break;
    }
    default:
      console.log(`usage:
  tsx src/cli.ts fetch <reddit|youtube|gplay|tavily>
  tsx src/cli.ts backfill --source <reddit|youtube|gplay|tavily> --days 30
  tsx src/cli.ts report [--notify false]
  tsx src/cli.ts anomaly [--notify false]
  tsx src/cli.ts enrich-pending [--limit 2000]
  tsx src/cli.ts faq [--max 12]
  tsx src/cli.ts fix-links`);
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
