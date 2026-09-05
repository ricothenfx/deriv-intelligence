import type { NormalizedItem } from "@deriv-intel/connectors";
import { withTx } from "./db";
import { cleanText, contentHash } from "./normalize";

export interface IngestedItem {
  id: number;
  sourceId: string;
}

export async function ingestItems(items: NormalizedItem[]): Promise<IngestedItem[]> {
  if (!items.length) return [];
  const inserted: IngestedItem[] = [];
  const seen = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items
      .slice(i, i + CHUNK)
      .filter((it) => it.content && it.content.trim())
      .filter((it) => {
        const key = `${it.source}:${contentHash(it.source, it.content)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (!chunk.length) continue;

    const values: unknown[] = [];
    const placeholders = chunk.map((it, j) => {
      const b = j * 11;
      values.push(
        it.source,
        it.sourceId,
        it.url ?? null,
        it.title ?? null,
        cleanText(it.content),
        it.author ?? null,
        it.language ?? null,
        it.publishedAt,
        JSON.stringify(it.engagement ?? {}),
        JSON.stringify(it.metadata ?? {}),
        contentHash(it.source, it.content),
      );
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9}::jsonb,$${b + 10}::jsonb,$${b + 11})`;
    });

    const sql = `
      insert into items (source, source_id, url, title, content, author, language, published_at, engagement, metadata, content_hash)
      values ${placeholders.join(",")}
      on conflict do nothing
      returning id, source_id`;

    const rows = await withTx(async (c) => (await c.query(sql, values as never[])).rows);
    for (const r of rows) inserted.push({ id: Number(r.id), sourceId: String(r.source_id) });
  }
  return inserted;
}

export async function saveQueryState(
  source: string,
  cursor: Record<string, unknown> | null,
  metrics?: Record<string, number>,
): Promise<void> {
  await withTx(async (c) => {
    await c.query(
      `insert into query_state (source, cursor, metrics, updated_at)
       values ($1, $2::jsonb, $3::jsonb, now())
       on conflict (source) do update set cursor = excluded.cursor, metrics = excluded.metrics, updated_at = now()`,
      [source, JSON.stringify(cursor ?? {}), JSON.stringify(metrics ?? {})],
    );
  });
}

export async function loadQueryState(source: string): Promise<{
  cursor: Record<string, unknown>;
  metrics: Record<string, number>;
} | null> {
  const { query } = await import("./db");
  const rows = await query<{ cursor: Record<string, unknown>; metrics: Record<string, number> }>(
    `select cursor, metrics from query_state where source = $1`,
    [source],
  );
  return rows[0] ?? null;
}
