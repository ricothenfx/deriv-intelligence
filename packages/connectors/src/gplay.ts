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

function countries(): string[] {
  return (process.env.GPLAY_COUNTRIES || "us,gb,ng,id")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function fetchGplay(opts: FetchOptions): Promise<FetchResult> {
  const appId = process.env.GPLAY_APP_ID || "com.deriv.app";
  const num = Math.min(opts.limit ?? Number(process.env.GPLAY_REVIEWS_PER_COUNTRY ?? 150), 500);
  const cursors = (opts.cursor?.countries as Record<string, string> | undefined) ?? {};
  const nextCursors: Record<string, string> = {};
  const items: NormalizedItem[] = [];

  for (const c of countries()) {
    const res = await gplay.reviews({ appId, country: c, sort: 2, num } as any);
    const reviews = ((res as any).data ?? []) as GReview[];
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
        language: null,
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
  }

  return {
    items,
    cursor: { countries: nextCursors },
    metrics: { countries: countries().length },
  };
}
