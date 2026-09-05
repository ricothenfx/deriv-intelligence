export type SourceName = "reddit" | "youtube" | "gplay" | "tavily";

export interface NormalizedItem {
  source: SourceName;
  sourceId: string;
  url: string | null;
  title: string | null;
  content: string;
  author: string | null;
  language: string | null;
  publishedAt: Date;
  engagement: Record<string, number | string | null>;
  metadata: Record<string, unknown>;
}

export interface FetchWindow {
  from?: Date;
  to?: Date;
}

export interface FetchOptions {
  window?: FetchWindow;
  limit?: number;
  cursor?: Record<string, unknown> | null;
}

export interface FetchResult {
  items: NormalizedItem[];
  cursor: Record<string, unknown> | null;
  metrics?: Record<string, number>;
}
