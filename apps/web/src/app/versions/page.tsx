"use client";

import { useEffect, useState } from "react";
import { Card, EmptyHint, Loading, toneClass } from "@/components/ui";
import { getJson, type VersionRow } from "@/lib/api";

export default function VersionsPage() {
  const [days, setDays] = useState(90);
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getJson<{ versions: VersionRow[] }>(`/api/versions?days=${days}`)
      .then((r) => setVersions(r.versions))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Google Play — Pain Points per App Version</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Reviews grouped by app release version: average rating, sentiment and dominant complaints. Spot regressions introduced by a specific release.
          </p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300">
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
          <option value={180}>180 days</option>
          <option value={365}>1 year</option>
        </select>
      </div>

      {error && <div className="text-sm text-rose-300">Failed: {error}</div>}
      {loading && <Loading label="Loading versions…" />}
      {versions && versions.length === 0 && !loading && (
        <EmptyHint>No versioned reviews yet — gplay metadata carries appVersion.</EmptyHint>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {versions?.map((v) => (
          <Card key={v.version} className={v.sentiment < -0.15 ? "border-rose-500/40" : ""}>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-white">v{v.version}</span>
                <div className="text-[10px] text-slate-500">
                  {v.first_seen} → {v.last_seen}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-semibold ${v.avg_rating < 3 ? "text-rose-400" : v.avg_rating >= 4 ? "text-emerald-400" : "text-slate-300"}`}>
                  {v.avg_rating.toFixed(1)}★
                </div>
                <div className="text-[10px] text-slate-500">{v.mentions} reviews</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className={toneClass(v.sentiment)}>sentiment {v.sentiment.toFixed(2)}</span>
              <span className="text-rose-400/80">{v.negative} neg</span>
            </div>
            {(v.top_aspects.length > 0 || v.top_topics.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {v.top_aspects.map((a, i) => (
                  <span
                    key={i}
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      a.sentiment === "negative" ? "bg-rose-500/15 text-rose-300" : a.sentiment === "positive" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {a.name}
                  </span>
                ))}
                {v.top_topics.map((t, i) => (
                  <span key={i} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-sky-300">{t}</span>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
