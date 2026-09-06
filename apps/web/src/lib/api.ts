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
  source_id: string;
  url: string | null;
  title: string | null;
  content: string;
  sentiment: string | null;
  sentiment_score: number;
  topics: string[];
  country: string | null;
  stage: string | null;
  language: string | null;
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

export interface BrandStat {
  brand: string;
  mentions: number;
  sentiment: number;
  negative: number;
  positive: number;
  avg_engagement: number;
  share: number;
}

export interface BrandAspectRow {
  brand: string;
  aspect: string;
  sentiment: number;
  mentions: number;
}

export interface SwitcherRow {
  from_brand: string;
  to_brand: string;
  mentions: number;
  sample: string;
  url: string | null;
  published_at: string | null;
}

export interface KolRow {
  author: string;
  source: string;
  profile_url: string | null;
  example_url: string | null;
  mentions: number;
  total_engagement: number;
  avg_sentiment: number;
  negative_share: number;
  countries: string[];
  topics: string[];
  score: number;
  reach: number | null;
  last_active: string | null;
}

export interface VersionRow {
  version: string;
  mentions: number;
  avg_rating: number;
  sentiment: number;
  negative: number;
  top_aspects: { name: string; sentiment: string }[];
  top_topics: string[];
  first_seen: string | null;
  last_seen: string | null;
}

export interface ReplayBucket {
  bucket: string;
  country: string;
  mentions: number;
  sentiment: number;
}

export interface DailyMetric {
  day: string;
  sentiment: number;
  mentions: number;
  gplay_rating: number | null;
  gplay_negative: number;
}

export interface Correlation {
  name: string;
  description: string;
  r: number | null;
  note: string;
}

export interface FaqRow {
  id: number;
  question: string;
  answer: string;
  language: string | null;
  created_at: string;
}

export interface CopilotDraft {
  item_id: number;
  draft: string;
  tone: string;
  language: string;
  escalate: boolean;
  severity: string;
  rationale: string;
}

export interface TicketRow {
  id: number;
  item_id: number;
  draft: string | null;
  severity: string;
  status: string;
  created_at: string;
  content_preview: string | null;
  country: string | null;
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

export async function putJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface SourceStatus {
  source: string;
  label: string;
  schedule: string;
  last_grab: string | null;
  last_item_at: string | null;
  items: number;
  new_items: number;
  quota_used: number | null;
  quota_budget: number | null;
  pending_enrichment: number;
}

export interface SourcesResponse {
  sources: SourceStatus[];
  worker: { running: boolean };
}

export interface FetchJobStatus {
  jobId: string;
  source: string;
  state: string;
  fetched: number | null;
  inserted: number | null;
  error: string | null;
}

export interface KeywordSourceConfig {
  source: string;
  label: string;
  queries: string[];
  defaults: string[];
  configured: boolean;
}

export interface KeywordsResponse {
  sources: KeywordSourceConfig[];
}

export const fmtSigned = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;

export const fmtDelta = (n: number | null) =>
  n == null ? "—" : `${n >= 0 ? "+" : ""}${(n * 100).toFixed(0)}%`;

export function mentionHref(m: { source: string; url: string | null; source_id?: string | null }): string | null {
  if (m.url) {
    if (m.source === "youtube" && m.source_id && m.source_id.startsWith("Ug") && !m.url.includes("lc=")) {
      return `${m.url}${m.url.includes("?") ? "&" : "?"}lc=${m.source_id}`;
    }
    return m.url;
  }
  if (m.source === "reddit" && m.source_id && /^(t1|t3)_/.test(m.source_id)) {
    return `https://www.reddit.com/by_id/${m.source_id}`;
  }
  if (m.source === "gplay") {
    return `https://play.google.com/store/apps/details?id=${process.env.NEXT_PUBLIC_GPLAY_APP_ID ?? "com.deriv.app"}`;
  }
  return null;
}
