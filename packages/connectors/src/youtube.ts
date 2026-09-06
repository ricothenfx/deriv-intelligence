import type { FetchOptions, FetchResult, NormalizedItem } from "./types";

const API = "https://www.googleapis.com/youtube/v3";
const SEARCH_COST = 100;
const LIST_COST = 1;

function apiKey(): string {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new Error("YOUTUBE_API_KEY not set");
  return k;
}

function envQueries(): string[] {
  return (process.env.YOUTUBE_QUERIES || "Deriv broker review")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function queries(opts: FetchOptions): string[] {
  return opts.queries?.length ? opts.queries : envQueries();
}

function dailyQuota(): number {
  return Number(process.env.YOUTUBE_DAILY_QUOTA ?? 9500);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}/${path}`);
  url.searchParams.set("key", apiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`youtube ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function fetchYoutube(opts: FetchOptions): Promise<FetchResult> {
  const quota = { date: todayKey(), used: 0, ...(opts.cursor?.quota as { date: string; used: number } | undefined) };
  if (quota.date !== todayKey()) quota.used = 0;
  const budget = dailyQuota();
  const lastRun = String(opts.cursor?.lastRun ?? new Date(Date.now() - 7 * 86400_000).toISOString());

  const publishedAfter = opts.window?.from ? opts.window.from.toISOString() : lastRun;
  const publishedBefore = opts.window?.to ? opts.window.to.toISOString() : undefined;

  const videoIds: string[] = [];
  const videoQuery = new Map<string, string>();
  const items: NormalizedItem[] = [];

  for (const q of queries(opts)) {
    if (quota.used + SEARCH_COST > budget) break;
    const json = await call<any>("search", {
      part: "snippet",
      q,
      type: "video",
      order: "date",
      maxResults: "50",
      publishedAfter,
      ...(publishedBefore ? { publishedBefore } : {}),
    });
    quota.used += SEARCH_COST;
    for (const it of json.items ?? []) {
      const id: string | undefined = it?.id?.videoId;
      if (id) {
        videoIds.push(id);
        videoQuery.set(id, q);
      }
    }
  }

  const stats = new Map<string, { viewCount?: number; likeCount?: number; commentCount?: number; description?: string; channelTitle?: string; channelId?: string; publishedAt?: string }>();
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    if (quota.used + LIST_COST > budget) break;
    const json = await call<any>("videos", { part: "statistics,snippet", id: chunk.join(",") });
    quota.used += LIST_COST;
    for (const v of json.items ?? []) {
      stats.set(v.id, {
        viewCount: Number(v.statistics?.viewCount ?? 0),
        likeCount: Number(v.statistics?.likeCount ?? 0),
        commentCount: Number(v.statistics?.commentCount ?? 0),
        description: v.snippet?.description ?? "",
        channelTitle: v.snippet?.channelTitle ?? "",
        channelId: v.snippet?.channelId ?? "",
        publishedAt: v.snippet?.publishedAt,
      });
    }
  }

  const channelIds = [...new Set([...stats.values()].map((s) => s.channelId).filter((c): c is string => !!c))];
  const channelSubs = new Map<string, number>();
  for (let i = 0; i < channelIds.length; i += 50) {
    const chunk = channelIds.slice(i, i + 50);
    if (quota.used + LIST_COST > budget) break;
    try {
      const json = await call<any>("channels", { part: "statistics", id: chunk.join(",") });
      quota.used += LIST_COST;
      for (const ch of json.items ?? []) {
        const subs = Number(ch?.statistics?.subscriberCount);
        if (ch?.id && Number.isFinite(subs)) channelSubs.set(ch.id, subs);
      }
    } catch {
      break;
    }
  }

  for (const id of videoIds) {
    const s = stats.get(id);
    if (!s) continue;
    items.push({
      source: "youtube",
      sourceId: `yt:video:${id}`,
      url: `https://www.youtube.com/watch?v=${id}`,
      title: null,
      content: s.description ? s.description.slice(0, 5000) : `YouTube video ${id}`,
      author: s.channelTitle ?? null,
      language: null,
      publishedAt: new Date(s.publishedAt ?? Date.now()),
      engagement: { viewCount: s.viewCount ?? 0, likeCount: s.likeCount ?? 0, comments: s.commentCount ?? 0 },
      metadata: {
        kind: "video",
        videoId: id,
        channelId: s.channelId ?? null,
        channelSubs: channelSubs.get(s.channelId ?? "") ?? null,
        query: videoQuery.get(id) ?? null,
      },
    });
  }

  const maxCommentsPerVideo = Number(process.env.YOUTUBE_COMMENTS_PER_VIDEO ?? 100);
  for (const id of videoIds) {
    if (quota.used + LIST_COST > budget) break;
    try {
      const json = await call<any>("commentThreads", {
        part: "snippet",
        videoId: id,
        maxResults: String(Math.min(maxCommentsPerVideo, 100)),
        order: "time",
        textFormat: "plainText",
      });
      quota.used += LIST_COST;
      for (const ct of json.items ?? []) {
        const c = ct?.snippet?.topLevelComment?.snippet;
        if (!c?.textOriginal) continue;
        items.push({
          source: "youtube",
          sourceId: String(ct.id),
          url: `https://www.youtube.com/watch?v=${id}&lc=${ct.id}`,
          title: null,
          content: String(c.textOriginal).slice(0, 5000),
          author: c.authorDisplayName ?? null,
          language: null,
          publishedAt: new Date(c.publishedAt ?? Date.now()),
          engagement: { likes: c.likeCount ?? 0 },
          metadata: { kind: "comment", videoId: id, query: videoQuery.get(id) ?? null, authorChannelId: c.authorChannelId?.value ?? null },
        });
      }
    } catch {
      continue;
    }
  }

  return {
    items,
    cursor: { quota, lastRun: new Date().toISOString() },
    metrics: { quotaUsed: quota.used, videos: videoIds.length, channels: channelIds.length },
  };
}
