"use client";

import { useEffect, useState } from "react";
import { BarRow, Card, EmptyHint, Loading, toneClass } from "@/components/ui";
import { HELP } from "@/lib/help";
import { getJson, type BrandAspectRow, type BrandStat, type GroupStat, type SwitcherRow } from "@/lib/api";

export default function CompetitorsPage() {
  const [days, setDays] = useState(30);
  const [country, setCountry] = useState("");
  const [countries, setCountries] = useState<GroupStat[]>([]);
  const [brands, setBrands] = useState<BrandStat[] | null>(null);
  const [aspects, setAspects] = useState<BrandAspectRow[]>([]);
  const [switchers, setSwitchers] = useState<SwitcherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ countries: GroupStat[] }>("/api/countries?days=30")
      .then((r) => setCountries(r.countries))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ days: String(days) });
    if (country) params.set("country", country);
    getJson<{ brands: BrandStat[]; aspects: BrandAspectRow[]; switchers: SwitcherRow[] }>(`/api/benchmark?${params}`)
      .then((r) => {
        setBrands(r.brands);
        setAspects(r.aspects);
        setSwitchers(r.switchers);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [days, country]);

  const maxMentions = brands ? Math.max(...brands.map((b) => b.mentions), 1) : 1;
  const brandNames = [...new Set(aspects.map((a) => a.brand))];
  const aspectNames = [...new Set(aspects.map((a) => a.aspect))].slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Competitor Benchmark</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Share of voice, sentiment and aspect comparison vs Exness / IQ Option / OctaFX — plus switcher detection from real posts.
          </p>
        </div>
        <div className="flex gap-2">
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300">
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c.key} value={c.key}>{c.key}</option>
            ))}
          </select>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300">
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      {error && <div className="text-sm text-rose-300">Failed: {error}</div>}
      {loading && <Loading label="Loading benchmark…" />}

      {brands && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Share of voice (mentions)" hint={HELP.share_of_voice}>
            {brands.length === 0 ? (
              <EmptyHint>No competitor data yet — run a fetch/backfill first.</EmptyHint>
            ) : (
              brands.map((b) => (
                <BarRow
                  key={b.brand}
                  label={b.brand}
                  value={b.mentions}
                  max={maxMentions}
                  right={`${(b.share * 100).toFixed(0)}% · ${b.mentions}`}
                  color={b.brand === "deriv" ? "#38bdf8" : "#64748b"}
                />
              ))
            )}
          </Card>

          <Card title="Weighted sentiment by brand" hint={HELP.brand_sentiment}>
            {brands.length === 0 ? (
              <EmptyHint>No data.</EmptyHint>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pb-2 font-medium">Brand</th>
                    <th className="pb-2 font-medium">Sentiment</th>
                    <th className="pb-2 font-medium">Negative</th>
                    <th className="pb-2 font-medium">Positive</th>
                    <th className="pb-2 font-medium">Avg eng.</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.map((b) => (
                    <tr key={b.brand} className="border-t border-slate-800/60">
                      <td className="py-1.5 font-medium text-slate-200">{b.brand}</td>
                      <td className={`py-1.5 ${toneClass(b.sentiment)}`}>{b.sentiment.toFixed(2)}</td>
                      <td className="py-1.5 text-rose-400">{(b.mentions ? (b.negative / b.mentions) * 100 : 0).toFixed(0)}%</td>
                      <td className="py-1.5 text-emerald-400">{(b.mentions ? (b.positive / b.mentions) * 100 : 0).toFixed(0)}%</td>
                      <td className="py-1.5 text-slate-400">{b.avg_engagement.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {aspects.length > 0 && (
        <Card title="Aspect sentiment: Deriv vs competitors" hint={HELP.aspect_matrix}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2 font-medium">Aspect</th>
                  {brandNames.map((b) => (
                    <th key={b} className="pb-2 font-medium">{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aspectNames.map((a) => (
                  <tr key={a} className="border-t border-slate-800/60">
                    <td className="py-1.5 text-slate-300">{a}</td>
                    {brandNames.map((b) => {
                      const cell = aspects.find((x) => x.aspect === a && x.brand === b);
                      return (
                        <td key={b} className={`py-1.5 ${cell ? toneClass(cell.sentiment) : "text-slate-700"}`}>
                          {cell ? cell.sentiment.toFixed(2) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Switchers — users moving between brands (last 90 days)" hint={HELP.switchers}>
        {switchers.length === 0 ? (
          <EmptyHint>No switcher posts detected yet. Grows as more multi-brand posts are collected.</EmptyHint>
        ) : (
          <div className="space-y-2">
            {switchers.map((s, i) => (
              <div key={i} className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-medium text-slate-200">{s.from_brand}</span>
                  <span className="text-slate-500">→</span>
                  <span className="font-medium text-sky-300">{s.to_brand}</span>
                  <span className="text-slate-500">· {s.mentions} posts</span>
                  {s.published_at && <span className="text-slate-600">{s.published_at}</span>}
                </div>
                {s.sample && <p className="line-clamp-2 italic text-slate-400">“{s.sample}”</p>}
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-sky-400 hover:underline">
                    open source →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
