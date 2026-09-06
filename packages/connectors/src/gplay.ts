import gplay from "google-play-scraper";
import type { FetchOptions, FetchResult, NormalizedItem } from "./types";

interface GReview {
  id: string;
  userName: string;
  date: string | Date;
  score: number;
  url: string;
  title: string;
  text: string;
  version: string;
  thumbsUp: number;
}

const COUNTRY_LANG: Record<string, string> = {
  id: "id", br: "pt", vn: "vi", th: "th", my: "ms", pk: "ur", bd: "bn",
};

function countries(): string[] {
  return (process.env.GPLAY_COUNTRIES || "us,gb,ng,id")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function langFor(country: string): string {
  const extra = process.env.GPLAY_LANGS;
  if (extra) {
    const map: Record<string, string> = {};
    for (const part of extra.split(",").map((s) => s.trim()).filter(Boolean)) {
      const [c, l] = part.split(":").map((x) => x?.trim().toLowerCase());
      if (c && l) map[c] = l;
    }
    if (map[country]) return map[country];
  }
  return COUNTRY_LANG[country] ?? "en";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchReviews(appId: string, country: string, lang: string, num: number): Promise<GReview[]> {
  const out: GReview[] = [];
  let token: string | null = null;
  for (let page = 0; page < 6 && out.length < num; page++) {
    const res: unknown = await gplay.reviews({
      appId,
      country,
      lang,
      sort: 2,
      num: Math.min(num - out.length, 150),
      ...(token ? { paginate: true, nextPaginationToken: token } : {}),
    } as never);
    const r = res as { data?: GReview[]; nextPaginationToken?: string | null };
    const batch = r.data ?? [];
    out.push(...batch);
    token = r.nextPaginationToken ?? null;
    if (!token || batch.length === 0) break;
    await sleep(400);
  }
  return out.slice(0, num);
}

export async function fetchGplay(opts: FetchOptions): Promise<FetchResult> {
  const appId = process.env.GPLAY_APP_ID || "com.deriv.app";
  const num = Math.min(opts.limit ?? Number(process.env.GPLAY_REVIEWS_PER_COUNTRY ?? 150), 500);
  const cursors = (opts.cursor?.countries as Record<string, string> | undefined) ?? {};
  const nextCursors: Record<string, string> = {};
  const items: NormalizedItem[] = [];

  for (const c of countries()) {
    const lang = langFor(c);
    let reviews: GReview[] = [];
    try {
      reviews = await fetchReviews(appId, c, lang, num);
      if (reviews.length === 0 && lang !== "en") {
        reviews = await fetchReviews(appId, c, "en", num);
      }
    } catch {
      continue;
    }
    const lastDate = cursors[c] ? new Date(cursors[c]) : null;
    let newest: Date | null = null;
    for (const r of reviews) {
      const d = new Date(r.date);
      if (Number.isNaN(d.getTime())) continue;
      if (lastDate && d <= lastDate) continue;
      if (opts.window?.from && d < opts.window.from) continue;
      if (opts.window?.to && d > opts.window.to) continue;
      if (!newest || d > newest) newest = d;
      const text = [r.title, r.text].filter((x) => x && String(x).trim()).join(" — ");
      if (!text.trim()) continue;
      items.push({
        source: "gplay",
        sourceId: `gplay:${c}:${r.id}`,
        url: r.url || null,
        title: r.title || null,
        content: text,
        author: r.userName || null,
        language: lang,
        publishedAt: d,
        engagement: { score: r.score, thumbsUp: r.thumbsUp ?? 0 },
        metadata: {
          country: c.toUpperCase(),
          rating: r.score,
          appVersion: r.version ?? null,
          kind: "app_review",
        },
      });
    }
    if (newest) nextCursors[c] = newest.toISOString();
    await sleep(300);
  }

  return {
    items,
    cursor: { countries: nextCursors },
    metrics: { countries: countries().length },
  };
}
