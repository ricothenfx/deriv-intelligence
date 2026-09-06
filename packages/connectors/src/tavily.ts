import { createHash } from "crypto";
import type { FetchOptions, FetchResult, NormalizedItem } from "./types";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  published_date?: string | null;
}

function envQueries(): string[] {
  return (process.env.TAVILY_QUERIES || "Deriv broker review")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function queries(opts: FetchOptions): string[] {
  return opts.queries?.length ? opts.queries : envQueries();
}

export async function fetchTavily(opts: FetchOptions): Promise<FetchResult> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY not set");
  const daysAgo = opts.window?.from
    ? Math.ceil((Date.now() - opts.window.from.getTime()) / 86400_000)
    : 7;
  const days = Math.min(Math.max(daysAgo, 1), 30);
  const lastSeen = String(opts.cursor?.lastSeen ?? "");
  let newest = lastSeen;
  let credits = 0;
  const items: NormalizedItem[] = [];
  const seen = new Set<string>();

  for (const q of queries(opts)) {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: q,
        topic: "news",
        days,
        max_results: 20,
        search_depth: "basic",
      }),
    });
    credits++;
    if (!res.ok) throw new Error(`tavily failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { results: TavilyResult[] };
    for (const r of json.results ?? []) {
      const key2 = createHash("sha1").update(r.url + "|" + r.title).digest("hex").slice(0, 20);
      if (seen.has(key2)) continue;
      seen.add(key2);
      const published = r.published_date ? new Date(r.published_date) : new Date();
      if (Number.isNaN(published.getTime())) continue;
      if (lastSeen && published.toISOString() <= lastSeen) continue;
      if (opts.window?.from && published < opts.window.from) continue;
      if (opts.window?.to && published > opts.window.to) continue;
      if (!newest || published.toISOString() > newest) newest = published.toISOString();
      let host: string | null = null;
      try {
        host = new URL(r.url).hostname;
      } catch {
        host = null;
      }
      items.push({
        source: "tavily",
        sourceId: `tavily:${key2}`,
        url: r.url,
        title: r.title ?? null,
        content: r.content ?? "",
        author: null,
        language: null,
        publishedAt: published,
        engagement: { score: r.score ?? 1 },
        metadata: { domain: host, query: q, dateEstimated: !r.published_date, kind: "web" },
      });
    }
  }

  return { items, cursor: { lastSeen: newest }, metrics: { credits } };
}
