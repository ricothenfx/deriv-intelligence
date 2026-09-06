import type { FetchOptions, FetchResult, NormalizedItem } from "./types";

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API = "https://oauth.reddit.com";
const MIN_INTERVAL_MS = 1100;

let token: { value: string; expiresAt: number } | null = null;
let lastRequestAt = 0;

interface RedditChild {
  kind: string;
  data: Record<string, any>;
}

function userAgent(): string {
  return process.env.REDDIT_USER_AGENT || "deriv-intelligence/0.1 (research)";
}

async function getToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value;
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) throw new Error("REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set");
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(),
    },
    body: "grant_type=client_credentials&device_id=divintel0000000000deadbeef",
  });
  if (!res.ok) throw new Error(`reddit token failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return token.value;
}

async function apiGet(path: string, params: Record<string, string>): Promise<any> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  const t = await getToken();
  const url = new URL(path, API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${t}`, "User-Agent": userAgent() } });
  if (res.status === 429) await new Promise((r) => setTimeout(r, 8000));
  if (!res.ok) throw new Error(`reddit ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function envQueries(): string[] {
  return (process.env.REDDIT_QUERIES || "Deriv broker,Deriv withdrawal,Deriv review")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function queries(opts: FetchOptions): string[] {
  return opts.queries?.length ? opts.queries : envQueries();
}

function subreddits(): string[] {
  return (process.env.REDDIT_SUBREDDITS || "")
    .split(",")
    .map((s) => s.trim().replace(/^\/?r\//i, ""))
    .filter(Boolean);
}

function mapChild(ch: RedditChild, query: string): NormalizedItem | null {
  const d = ch.data || {};
  if (ch.kind === "t3") {
    const content = (d.selftext && String(d.selftext).trim()) || d.title || "";
    if (!content) return null;
    return {
      source: "reddit",
      sourceId: String(d.name),
      url: d.permalink ? `https://www.reddit.com${d.permalink}` : null,
      title: d.title ?? null,
      content: String(content),
      author: d.author ?? null,
      language: null,
      publishedAt: new Date(d.created_utc * 1000),
      engagement: { score: d.score ?? 0, comments: d.num_comments ?? 0, upvoteRatio: d.upvote_ratio ?? null },
      metadata: { subreddit: d.subreddit ?? null, kind: "post", query },
    };
  }
  if (ch.kind === "t1") {
    const content = d.body ? String(d.body).trim() : "";
    if (!content) return null;
    return {
      source: "reddit",
      sourceId: String(d.name),
      url: d.permalink ? `https://www.reddit.com${d.permalink}` : null,
      title: d.link_title ?? null,
      content,
      author: d.author ?? null,
      language: null,
      publishedAt: new Date(d.created_utc * 1000),
      engagement: { score: d.score ?? 0 },
      metadata: { subreddit: d.subreddit ?? null, kind: "comment", query },
    };
  }
  return null;
}

export async function fetchReddit(opts: FetchOptions): Promise<FetchResult> {
  const items: NormalizedItem[] = [];
  const seen = new Set<string>();
  const lastSeen = Number(opts.cursor?.lastSeenUtc ?? 0);
  let maxSeen = lastSeen;
  let apiCalls = 0;
  const limit = opts.limit ?? 500;

  const collect = async (q: string, params: Record<string, string>, path = "/search"): Promise<void> => {
    let after = "";
    for (let page = 0; page < 10; page++) {
      const json = await apiGet(path, {
        q,
        sort: "new",
        limit: "100",
        raw_json: "1",
        ...params,
        ...(after ? { after } : {}),
      });
      apiCalls++;
      const children: RedditChild[] = json?.data?.children ?? [];
      if (children.length === 0) break;
      let reachedOld = false;
      for (const ch of children) {
        const created: number = ch.data?.created_utc ?? 0;
        if (opts.window) {
          if (opts.window.to && created * 1000 > opts.window.to.getTime()) continue;
          if (opts.window.from && created * 1000 < opts.window.from.getTime()) {
            reachedOld = true;
            continue;
          }
        } else if (lastSeen && created <= lastSeen) {
          reachedOld = true;
          continue;
        }
        const it = mapChild(ch, q);
        if (it && !seen.has(it.sourceId)) {
          seen.add(it.sourceId);
          items.push(it);
          maxSeen = Math.max(maxSeen, created);
        }
      }
      after = children[children.length - 1]?.data?.name ?? "";
      if (reachedOld || !after || items.length >= limit) break;
    }
  };

  for (const q of queries(opts)) {
    if (opts.window?.from && opts.window.to) {
      const fromSec = Math.floor(opts.window.from.getTime() / 1000);
      const toSec = Math.floor(opts.window.to.getTime() / 1000);
      await collect(`${q} AND timestamp:${fromSec}..${toSec}`, { syntax: "cloudsearch" });
    } else {
      await collect(q, { type: "link", t: "week" });
      await collect(q, { type: "comment", t: "week" });
    }
  }

  if (!opts.window && items.length < limit) {
    const brand = (process.env.TARGET_BRAND || "Deriv").trim();
    for (const sub of subreddits()) {
      await collect(brand, { type: "link", t: "week", restrict_sr: "on" }, `/r/${sub}/search`);
    }
  }

  return { items, cursor: { lastSeenUtc: maxSeen }, metrics: { apiCalls } };
}
