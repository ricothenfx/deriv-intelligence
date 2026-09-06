import { NextResponse } from "next/server";
import { query } from "@deriv-intel/core";
import { SOURCE_META, SOURCE_NAMES } from "@/server/fetch-queue";

export const dynamic = "force-dynamic";

interface QueryStateRow {
  source: string;
  cursor: Record<string, unknown>;
  metrics: Record<string, number>;
  updated_at: Date;
}

interface AggRow {
  source: string;
  items: number;
  last_item_at: Date | null;
  new_items: number;
  pending_enrichment: number;
}

export async function GET() {
  const [states, agg] = await Promise.all([
    query<QueryStateRow>(`select source, cursor, metrics, updated_at from query_state`),
    query<AggRow>(
      `select i.source,
         count(*)::int as items,
         max(i.fetched_at) as last_item_at,
         count(*) filter (where qs.source is not null and i.fetched_at > qs.updated_at)::int as new_items,
         count(*) filter (where e.item_id is null)::int as pending_enrichment
       from items i
       left join item_enrichments e on e.item_id = i.id
       left join query_state qs on qs.source = i.source
       group by i.source`,
    ),
  ]);
  const stateBySource = new Map(states.map((s) => [s.source, s]));
  const aggBySource = new Map(agg.map((a) => [a.source, a]));

  const sources = SOURCE_NAMES.map((source) => {
    const st = stateBySource.get(source);
    const ag = aggBySource.get(source);
    const quota = (st?.cursor as { quota?: { used?: number } } | undefined)?.quota;
    return {
      source,
      label: SOURCE_META[source].label,
      schedule: SOURCE_META[source].schedule,
      last_grab: st ? new Date(st.updated_at).toISOString() : null,
      last_item_at: ag?.last_item_at ? new Date(ag.last_item_at).toISOString() : null,
      items: Number(ag?.items ?? 0),
      new_items: Number(ag?.new_items ?? 0),
      quota_used: source === "youtube" && quota?.used != null ? Number(quota.used) : null,
      quota_budget: source === "youtube" ? Number(process.env.YOUTUBE_DAILY_QUOTA ?? 9500) : null,
      pending_enrichment: Number(ag?.pending_enrichment ?? 0),
    };
  });

  const totalPending = sources.reduce((s, x) => s + x.pending_enrichment, 0);
  return NextResponse.json({ sources, pending_enrichment: totalPending });
}
