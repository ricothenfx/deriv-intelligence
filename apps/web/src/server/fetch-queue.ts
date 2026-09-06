import { Queue } from "bullmq";
import IORedis from "ioredis";

export const SOURCE_NAMES = ["reddit", "youtube", "gplay", "tavily"] as const;
export type FetchSource = (typeof SOURCE_NAMES)[number];

export const SOURCE_META: Record<string, { label: string; schedule: string }> = {
  reddit: { label: "Reddit", schedule: "tiap 15 menit" },
  youtube: { label: "YouTube", schedule: "tiap jam" },
  gplay: { label: "Google Play", schedule: "tiap jam" },
  tavily: { label: "Web / News (Tavily)", schedule: "tiap 6 jam" },
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
