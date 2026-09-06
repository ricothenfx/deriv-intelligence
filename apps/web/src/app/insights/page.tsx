"use client";

import { useEffect, useState } from "react";
import { Card, EmptyHint, Loading, toneClass } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { getJson, type Correlation, type DailyMetric } from "@/lib/api";

interface InsightsResponse {
  days: number;
  series: DailyMetric[];
  correlations: Correlation[];
  weekday_pattern: { weekday: string; sentiment: number; mentions: number }[];
}

export default function InsightsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getJson<InsightsResponse>(`/api/insights?days=${days}`)
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Correlation Insights</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            What moves sentiment: complaint bursts, app ratings, weekday patterns. Pearson r over daily aggregates.
          </p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300">
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

      {error && <div className="text-sm text-rose-300">Failed: {error}</div>}
      {loading && <Loading label="Computing correlations…" />}

      {data && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {data.correlations.map((c) => (
              <Card key={c.name} title={c.name}>
                <div className={`text-3xl font-semibold ${c.r == null ? "text-slate-600" : c.r < -0.4 ? "text-rose-400" : c.r > 0.4 ? "text-emerald-400" : "text-slate-300"}`}>
                  {c.r == null ? "n/a" : c.r.toFixed(2)}
                </div>
                <p className="mt-1 text-xs text-slate-500">{c.description}</p>
                <p className="mt-2 text-xs text-slate-400">{c.note}</p>
              </Card>
            ))}
          </div>

          <Card title="Daily sentiment vs volume">
            {data.series.length === 0 ? (
              <EmptyHint>No data in range.</EmptyHint>
            ) : (
              <TrendChart
                data={data.series.map((d) => ({
                  bucket: d.day,
                  mentions: d.mentions,
                  sentiment: d.sentiment,
                }))}
              />
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Google Play rating vs social sentiment">
              {data.series.filter((d) => d.gplay_rating != null).length === 0 ? (
                <EmptyHint>No rated days yet.</EmptyHint>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-2 font-medium">Day</th>
                      <th className="pb-2 font-medium">Play rating</th>
                      <th className="pb-2 font-medium">Social sentiment</th>
                      <th className="pb-2 font-medium">GPlay complaints</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.series
                      .filter((d) => d.gplay_rating != null)
                      .slice(-12)
                      .reverse()
                      .map((d) => (
                        <tr key={d.day} className="border-t border-slate-800/60">
                          <td className="py-1.5 text-slate-400">{d.day}</td>
                          <td className={`py-1.5 ${d.gplay_rating! < 3 ? "text-rose-400" : "text-slate-300"}`}>{d.gplay_rating!.toFixed(2)}★</td>
                          <td className={`py-1.5 ${toneClass(d.sentiment)}`}>{d.sentiment.toFixed(2)}</td>
                          <td className="py-1.5 text-rose-400/80">{d.gplay_negative}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title="Weekday pattern">
              {data.weekday_pattern.length === 0 ? (
                <EmptyHint>No data.</EmptyHint>
              ) : (
                <div className="space-y-1.5">
                  {data.weekday_pattern.map((w) => (
                    <div key={w.weekday} className="flex items-center gap-3 text-xs">
                      <span className="w-8 text-slate-400">{w.weekday}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800/70">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${Math.min(100, (w.mentions / Math.max(...data.weekday_pattern.map((x) => x.mentions), 1)) * 100)}%`,
                            background: w.sentiment < -0.08 ? "#ef4444" : w.sentiment > 0.08 ? "#22c55e" : "#475569",
                          }}
                        />
                      </div>
                      <span className={`w-20 text-right ${toneClass(w.sentiment)}`}>{w.sentiment.toFixed(2)} · {w.mentions}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
