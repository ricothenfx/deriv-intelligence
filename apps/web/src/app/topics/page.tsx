"use client";

import { useEffect, useState } from "react";
import { Card, EmptyHint, Loading, SentimentPill, toneClass } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import {
  fmtDelta,
  getJson,
  type EmergingTopic,
  type GroupStat,
  type MentionRow,
  type SeriesPoint,
} from "@/lib/api";

interface TopicsResponse {
  topics: GroupStat[];
  emerging: EmergingTopic[];
  topic?: string;
  series?: SeriesPoint[];
  mentions?: MentionRow[];
}

export default function TopicsPage() {
  const [country, setCountry] = useState("");
  const [countries, setCountries] = useState<GroupStat[]>([]);
  const [topic, setTopic] = useState<string | null>(null);
  const [data, setData] = useState<TopicsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ countries: GroupStat[] }>("/api/countries?days=30")
      .then((r) => setCountries(r.countries))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    const params = new URLSearchParams({ days: "7" });
    if (country) params.set("country", country);
    if (topic) params.set("topic", topic);
    getJson<TopicsResponse>(`/api/topics?${params}`)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [country, topic]);

  const maxMentions = Math.max(...(data?.topics ?? []).map((t) => t.mentions), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-white">Topics & Emerging Trends</h1>
          <p className="mt-0.5 text-xs text-slate-500">AI-classified topics + detection of topics rising vs last week.</p>
        </div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300"
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c.key} value={c.key}>
              {c.key}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="text-sm text-rose-300">Failed to load: {error}</div>}
      {!data && !error && <Loading />}

      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Topics (7 days)" className="lg:col-span-2">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1.5 font-medium">Topic</th>
                  <th className="py-1.5 font-medium">Share</th>
                  <th className="py-1.5 text-right font-medium">Mentions</th>
                  <th className="py-1.5 text-right font-medium">Sentiment</th>
                </tr>
              </thead>
              <tbody>
                {data.topics.map((t) => (
                  <tr
                    key={t.key}
                    onClick={() => setTopic(t.key === topic ? null : t.key)}
                    className={`cursor-pointer border-t border-slate-800/60 hover:bg-slate-800/40 ${topic === t.key ? "bg-slate-800/60" : ""}`}
                  >
                    <td className="py-1.5 font-medium text-slate-200">{t.key}</td>
                    <td className="py-1.5">
                      <div className="h-1.5 w-24 overflow-hidden rounded bg-slate-800">
                        <div className="h-full rounded bg-sky-500/70" style={{ width: `${(t.mentions / maxMentions) * 100}%` }} />
                      </div>
                    </td>
                    <td className="py-1.5 text-right text-slate-400">{t.mentions}</td>
                    <td className={`py-1.5 text-right font-medium ${toneClass(t.sentiment)}`}>{t.sentiment.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.topics.length === 0 && <EmptyHint>No topics yet</EmptyHint>}
          </Card>

          <Card title="Emerging (7d vs prev 7d)">
            <ul className="space-y-2">
              {data.emerging.length === 0 && <EmptyHint>No rising trends yet</EmptyHint>}
              {data.emerging.map((t) => (
                <li
                  key={t.topic}
                  onClick={() => setTopic(t.topic === topic ? null : t.topic)}
                  className="flex cursor-pointer items-center justify-between rounded border border-slate-800 bg-slate-900/70 px-2.5 py-2 text-xs hover:border-slate-700"
                >
                  <span className="text-slate-200">{t.topic}</span>
                  <span className="text-slate-500">
                    {t.previous} → <span className="font-semibold text-slate-300">{t.current}</span>{" "}
                    <span className="text-amber-400">{fmtDelta(t.delta)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {topic && data.series && (
            <>
              <Card title={`Topic trend: ${topic}`} className="lg:col-span-2">
                <TrendChart data={data.series} />
              </Card>
              <Card title={`Mentions: ${topic}`}>
                <div className="space-y-2">
                  {(data.mentions ?? []).slice(0, 6).map((m) => (
                    <div key={m.id} className="rounded border border-slate-800 bg-slate-900/80 p-2 text-xs">
                      <div className="mb-1 flex items-center gap-2">
                        <SentimentPill sentiment={m.sentiment} />
                        <span className="text-slate-500">{m.country ?? "?"} · {m.published_at}</span>
                      </div>
                      <p className="line-clamp-2 text-slate-300">{m.content}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
