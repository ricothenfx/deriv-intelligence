import type { Job } from "bullmq";
import { CONNECTORS, type FetchOptions } from "@deriv-intel/connectors";
import {
  getKeywords,
  ingestItems,
  loadQueryState,
  saveQueryState,
  runEnrichment,
} from "@deriv-intel/core";
import { getQueue, QUEUE_ENRICH, type FetchJobData } from "../queues";

export async function processFetch(job: Job<FetchJobData>): Promise<{ fetched: number; inserted: number }> {
  const { source, window } = job.data;
  const state = await loadQueryState(source);
  const queries = await getKeywords(source);
  const opts: FetchOptions = {
    cursor: (state?.cursor as Record<string, unknown>) ?? null,
    ...(queries.length ? { queries } : {}),
    ...(window ? { window: { from: new Date(window.from), to: new Date(window.to) } } : {}),
  };

  const result = await CONNECTORS[source](opts);
  const inserted = await ingestItems(result.items);
  await saveQueryState(source, result.cursor, result.metrics);

  const ids = inserted.map((x) => x.id);
  const enrichQueue = getQueue(QUEUE_ENRICH);
  for (let i = 0; i < ids.length; i += 20) {
    await enrichQueue.add(
      "enrich",
      { ids: ids.slice(i, i + 20) },
      { attempts: 3, backoff: { type: "exponential", delay: 10000 }, removeOnComplete: { age: 3600 }, removeOnFail: { age: 86400 } },
    );
  }

  const metrics = Object.entries(result.metrics ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  await job.log(`${source}: fetched=${result.items.length} new=${inserted.length} ${metrics}`);
  return { fetched: result.items.length, inserted: inserted.length };
}

export async function processEnrich(job: Job<{ ids: number[] }>): Promise<{ enriched: number; bots: number }> {
  const out = await runEnrichment(job.data.ids);
  await job.log(`enriched=${out.enriched} bots=${out.bots} skipped=${out.skipped}`);
  return { enriched: out.enriched, bots: out.bots };
}
