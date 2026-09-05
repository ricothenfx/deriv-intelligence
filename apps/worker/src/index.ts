import { config } from "dotenv";
import { join } from "path";

config({ path: join(__dirname, "../../../.env") });
import { Worker, type Job } from "bullmq";
import { setUsageSink } from "@deriv-intel/llm";
import { detectAnomalies, generateWeeklyReport, withTx } from "@deriv-intel/core";
import { processFetch, processEnrich } from "./processors/fetch";
import { redisConnection } from "./redis";
import { getQueue, QUEUE_ENRICH, QUEUE_FETCH, QUEUE_MAINTENANCE } from "./queues";

setUsageSink((u) =>
  withTx(async (c) => {
    await c.query(
      `insert into llm_usage (purpose, model, source, input_tokens, output_tokens, cost_usd)
       values ($1, $2, $3, $4, $5, $6)`,
      [u.purpose, u.model, u.source, u.inputTokens, u.outputTokens, u.costUsd],
    );
  }).catch((e) => console.warn("usage sink failed:", e instanceof Error ? e.message : e)),
);

const connection = redisConnection();

const fetchWorker = new Worker(QUEUE_FETCH, processFetch, { connection, concurrency: 2 });
const enrichWorker = new Worker(QUEUE_ENRICH, processEnrich, { connection, concurrency: 2 });
const maintenanceWorker = new Worker(
  QUEUE_MAINTENANCE,
  async (job: Job) => {
    if (job.name === "anomaly") {
      const created = await detectAnomalies({ notify: true });
      return { created };
    }
    if (job.name === "report") {
      const report = await generateWeeklyReport({ notify: true });
      return { id: report.id, filePath: report.filePath };
    }
    return { skipped: true };
  },
  { connection, concurrency: 1 },
);

for (const w of [fetchWorker, enrichWorker, maintenanceWorker]) {
  w.on("failed", (job, err) => console.error(`job ${job?.name ?? "?"}(${job?.id ?? "?"}) failed:`, err.message));
}

async function schedule(): Promise<void> {
  const repeat = async (queue: string, name: string, pattern: string, data: unknown = {}) => {
    await getQueue(queue).add(name, data, {
      repeat: { pattern },
      jobId: `${name}-cron`,
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    });
  };
  await repeat(QUEUE_FETCH, "reddit", "*/15 * * * *", { source: "reddit" });
  await repeat(QUEUE_FETCH, "youtube", "20 * * * *", { source: "youtube" });
  await repeat(QUEUE_FETCH, "gplay", "40 * * * *", { source: "gplay" });
  await repeat(QUEUE_FETCH, "tavily", "0 */6 * * *", { source: "tavily" });
  await repeat(QUEUE_MAINTENANCE, "anomaly", "10 * * * *");
  await repeat(QUEUE_MAINTENANCE, "report", "0 6 * * 1");
  console.log("scheduled cron jobs: reddit */15m, youtube hourly, gplay hourly, tavily 6h, anomaly hourly, report weekly");
}

async function shutdown(): Promise<void> {
  console.log("shutting down...");
  await Promise.allSettled([fetchWorker.close(), enrichWorker.close(), maintenanceWorker.close()]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

schedule()
  .then(() => console.log("worker ready"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
