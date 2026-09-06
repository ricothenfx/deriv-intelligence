import { query, withTx } from "./db";

export const KEYWORD_SOURCES = ["reddit", "youtube", "tavily"] as const;
export type KeywordSource = (typeof KEYWORD_SOURCES)[number];

export interface KeywordSourceConfig {
  source: string;
  label: string;
  queries: string[];
  defaults: string[];
  configured: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  reddit: "Reddit",
  youtube: "YouTube",
  tavily: "Web / News (Tavily)",
};

const FALLBACK: Record<string, string> = {
  reddit: "Deriv broker,Deriv withdrawal,Deriv review",
  youtube: "Deriv broker review",
  tavily: "Deriv broker review",
};

export function isKeywordSource(source: string): source is KeywordSource {
  return (KEYWORD_SOURCES as readonly string[]).includes(source);
}

export function envKeywords(source: string): string[] {
  if (!isKeywordSource(source)) return [];
  const envKey = `${source.toUpperCase()}_QUERIES`;
  const raw = process.env[envKey] || FALLBACK[source] || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalize(queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of queries) {
    const t = q.trim().slice(0, 200);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= 50) break;
  }
  return out;
}

export async function getKeywords(source: string): Promise<string[]> {
  if (!isKeywordSource(source)) return [];
  const rows = await query<{ query: string }>(
    `select query from search_keywords where source = $1 and enabled order by id`,
    [source],
  );
  if (rows.length) return rows.map((r) => r.query);
  return envKeywords(source);
}

export async function keywordConfig(): Promise<KeywordSourceConfig[]> {
  const rows = await query<{ source: string; query: string }>(
    `select source, query from search_keywords where enabled order by source, id`,
  );
  return KEYWORD_SOURCES.map((source) => {
    const saved = rows.filter((r) => r.source === source).map((r) => r.query);
    const defaults = envKeywords(source);
    return {
      source,
      label: SOURCE_LABELS[source] ?? source,
      queries: saved.length ? saved : defaults,
      defaults,
      configured: saved.length > 0,
    };
  });
}

export async function setKeywords(source: string, queries: string[]): Promise<string[]> {
  if (!isKeywordSource(source)) throw new Error(`keywords are not configurable for source: ${source}`);
  const list = normalize(queries);
  await withTx(async (c) => {
    await c.query(`delete from search_keywords where source = $1`, [source]);
    for (let i = 0; i < list.length; i++) {
      await c.query(
        `insert into search_keywords (source, query, enabled) values ($1, $2, true)
         on conflict (source, query) do update set enabled = true`,
        [source, list[i]],
      );
    }
  });
  return list;
}

export async function resetKeywords(source: string): Promise<string[]> {
  if (!isKeywordSource(source)) throw new Error(`keywords are not configurable for source: ${source}`);
  await withTx(async (c) => {
    await c.query(`delete from search_keywords where source = $1`, [source]);
  });
  return envKeywords(source);
}
