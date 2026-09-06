"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, EmptyHint, InfoTip, Loading, SentimentPill, SourceLink, toneClass } from "@/components/ui";
import { HourlyChart, TrendChart } from "@/components/charts";
import { WorldMap } from "@/components/world-map";
import { HELP } from "@/lib/help";
import {
  getJson,
  type GroupStat,
  type HourlyPoint,
  type MentionRow,
  type OverviewStats,
  type SeriesPoint,
} from "@/lib/api";

interface CountriesResponse {
  countries: GroupStat[];
  overview: OverviewStats;
}

interface CountryDetail {
  country: string;
  overview: OverviewStats;
  series: SeriesPoint[];
  topics: GroupStat[];
  hourly: HourlyPoint[];
  mentions: MentionRow[];
}

export default function CountriesPage() {
  const [list, setList] = useState<CountriesResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CountryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<CountriesResponse>("/api/countries?days=30")
      .then(setList)
      .catch((e) => setError(String(e)));
  }, []);

  const openCountry = useCallback((c: string) => {
    setSelected(c);
    setDetail(null);
    getJson<CountryDetail>(`/api/countries?country=${c}&days=30`)
      .then(setDetail)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="text-sm text-rose-300">Failed to load: {error}</div>;
  if (!list) return <Loading label="Loading map…" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Location Intelligence</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Country estimated from Google Play country (exact), language, subreddit/domain — always with a confidence score.
        </p>
      </div>

      <Card title="Sentiment by country — 30 days (click a country to drill down)" hint={HELP.map_country}>
        <WorldMap
          data={list.countries.map((c) => ({ country: c.key, mentions: c.mentions, sentiment: c.sentiment }))}
          onSelect={openCountry}
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="All countries" hint={HELP.sentiment_by_country}>
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1.5 font-medium">Country</th>
                <th className="py-1.5 font-medium">Mentions</th>
                <th className="py-1.5 font-medium">Sentiment</th>
                <th className="py-1.5 font-medium">Neg</th>
                <th className="py-1.5 font-medium">Pos</th>
              </tr>
            </thead>
            <tbody>
              {list.countries.map((c) => (
                <tr
                  key={c.key}
                  onClick={() => openCountry(c.key)}
                  className={`cursor-pointer border-t border-slate-800/60 hover:bg-slate-800/40 ${selected === c.key ? "bg-slate-800/60" : ""}`}
                >
                  <td className="py-1.5 font-medium text-slate-200">{c.key}</td>
                  <td className="py-1.5 text-slate-400">{c.mentions}</td>
                  <td className={`py-1.5 font-medium ${toneClass(c.sentiment)}`}>{c.sentiment.toFixed(3)}</td>
                  <td className="py-1.5 text-rose-400">{c.negative}</td>
                  <td className="py-1.5 text-emerald-400">{c.positive}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.countries.length === 0 && <EmptyHint>No data yet</EmptyHint>}
        </Card>

        <Card title={selected ? `Drill-down: ${selected}` : "Drill-down"}>
          {!selected && <EmptyHint>Click a country on the map or in the table</EmptyHint>}
          {selected && !detail && <Loading label={`Loading ${selected}…`} />}
          {selected && detail && (
            <div className="space-y-3">
              <div className="flex gap-4 text-xs">
                <div>
                  <div className="text-slate-500">Mentions (30d)</div>
                  <div className="text-lg font-semibold text-white">{detail.overview.mentions}</div>
                </div>
                <div>
                  <div className="text-slate-500">Weighted sentiment</div>
                  <div className={`text-lg font-semibold ${toneClass(detail.overview.weighted_sentiment)}`}>
                    {detail.overview.weighted_sentiment.toFixed(3)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Neg / Pos</div>
                  <div className="text-lg font-semibold">
                    <span className="text-rose-400">{detail.overview.negative}</span>
                    <span className="text-slate-600"> / </span>
                    <span className="text-emerald-400">{detail.overview.positive}</span>
                  </div>
                </div>
              </div>
              <TrendChart data={detail.series} />
              <div>
                <div className="mb-1 text-xs font-medium text-slate-400">Top topics</div>
                <div className="flex flex-wrap gap-1.5">
                  {detail.topics.map((t) => (
                    <span key={t.key} className="rounded border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-300">
                      {t.key} <span className={toneClass(t.sentiment)}>{t.sentiment.toFixed(2)}</span>
                    </span>
                  ))}
                </div>
              </div>
              <HourlyChart data={detail.hourly} />
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-slate-400">Latest mentions <InfoTip text={HELP.latest_mentions} /></div>
                {detail.mentions.slice(0, 5).map((m) => (
                  <div key={m.id} className="rounded border border-slate-800 bg-slate-900/80 p-2 text-xs">
                    <div className="mb-1 flex items-center gap-2">
                      <SentimentPill sentiment={m.sentiment} />
                      <span className="text-slate-500">{m.stage ?? "-"} · {m.source} · {m.published_at}</span>
                      <span className="ml-auto">
                        <SourceLink m={m} label="buka sumber" className="text-[10px]" />
                      </span>
                    </div>
                    <p className="line-clamp-2 text-slate-300">{m.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
