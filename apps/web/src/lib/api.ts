export interface GroupStat {
  key: string;
  mentions: number;
  sentiment: number;
  negative: number;
  positive: number;
}

export interface SeriesPoint {
  bucket: string;
  mentions: number;
  sentiment: number;
}

export interface OverviewStats {
  mentions: number;
  weighted_sentiment: number;
  avg_sentiment: number;
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
  located: number;
}

export interface FunnelRow {
  stage: string;
  mentions: number;
  sentiment: number;
  negative: number;
}

export interface AspectRow {
  stage: string | null;
  aspect: string;
  negative: number;
}

export interface MentionRow {
  id: number;
  source: string;
  url: string | null;
  title: string | null;
  content: string;
  sentiment: string | null;
  sentiment_score: number;
  topics: string[];
  country: string | null;
  stage: string | null;
  published_at: string;
  engagement: number;
  score?: number;
}

export interface EmergingTopic {
  topic: string;
  current: number;
  previous: number;
  delta: number | null;
}

export interface HourlyPoint {
  hour: number;
  mentions: number;
  sentiment: number;
}

export interface AlertRow {
  id: number;
  created_at: string;
  metric: string;
  scope: string;
  country: string | null;
  topic: string | null;
  severity: string;
  confidence: number;
  z_score: number;
  baseline: number;
  observed: number;
  explanation: string | null;
  status: string;
  timeline: { at: string; event: string; detail: string }[];
}

export interface ChatLogEntry {
  name: string;
  args: Record<string, unknown>;
  summary: string;
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const fmtSigned = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;

export const fmtDelta = (n: number | null) =>
  n == null ? "—" : `${n >= 0 ? "+" : ""}${(n * 100).toFixed(0)}%`;

export function mentionHref(m: MentionRow): string | null {
  if (m.url) return m.url;
  if (m.source === "reddit") return `https://reddit.com/comments/${m.id}`;
  return null;
}
