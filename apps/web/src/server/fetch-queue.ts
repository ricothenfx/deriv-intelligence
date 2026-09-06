import { Queue } from "bullmq";
import IORedis from "ioredis";

export const SOURCE_NAMES = ["reddit", "youtube", "gplay", "tavily"] as const;
export type FetchSource = (typeof SOURCE_NAMES)[number];

export const SOURCE_META: Record<string, { label: string; schedule: string }> = {
  reddit: { label: "Reddit", schedule: "every 15 min" },
  youtube: { label: "YouTube", schedule: "hourly" },
  gplay: { label: "Google Play", schedule: "hourly" },
  tavily: { label: "Web / News (Tavily)", schedule: "every 6 h" },
};

let connection: IORedis | null = null;
let queue: Queue | null = null;

export function getFetchQueue(): Queue {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
  }
  if (!queue) {
    queue = new Queue("fetch", { connection });
  }
  return queue;
}
