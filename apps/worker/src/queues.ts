import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const QUEUE_FETCH = "fetch";
export const QUEUE_ENRICH = "enrich";
export const QUEUE_MAINTENANCE = "maintenance";

export interface FetchJobData {
  source: "reddit" | "youtube" | "gplay" | "tavily";
  window?: { from: string; to: string };
}

export interface EnrichJobData {
  ids: number[];
}

const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: redisConnection() });
    queues.set(name, q);
  }
  return q;
}
