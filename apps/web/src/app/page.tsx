"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarRow,
  Card,
  EmptyHint,
  Loading,
  SentimentPill,
  SourceLink,
  Stat,
  toneClass,
} from "@/components/ui";
import { DataSourcesCard } from "@/components/data-sources";
import { TranslateButton } from "@/components/translate";
import { HourlyChart, TrendChart } from "@/components/charts";
import { HELP } from "@/lib/help";
import {
  fmtDelta,
  getJson,
  type AlertRow,
  type AspectRow,
  type EmergingTopic,
  type FunnelRow,
  type GroupStat,
  type HourlyPoint,
  type MentionRow,
  type OverviewStats,
  type SeriesPoint,
} from "@/lib/api";

interface OverviewResponse {
  overview: OverviewStats;
  prev: OverviewStats;
  series: SeriesPoint[];
  countries: GroupStat[];
  sources: GroupStat[];
  hourly: HourlyPoint[];
  emerging: EmergingTopic[];
  funnel: FunnelRow[];
  aspects: AspectRow[];
  alerts: AlertRow[];
  evidence: MentionRow[];
}

export default function OverviewPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    getJson<OverviewResponse>(`/api/overview?days=${days}`)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [days]);

  if (error) {
    return (
      <div className="rounded border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        Failed to load: {error}. Make sure `pnpm docker:up`, `pnpm migrate`, and `pnpm seed` have been run.
      </div>
    );
  }
  if (!data) return <Loading label="Loading overview…" />;

  const { overview: o, prev } = data;
  const deltaMentions = prev.mentions > 0 ? (o.mentions - prev.mentions) / prev.mentions : null;
  const deltaSent = o.weighted_sentiment - prev.weighted_sentiment;
  const maxCountry = Math.max(...data.countries.map((c) => c.mentions), 1);
  const maxSource = Math.max(...data.sources.map((c) => c.mentions), 1);
  const maxFunnel = Math.max(...data.funnel.map((x) => x.mentions), 1);
  const weakest = [...data.funnel].sort((a, b) => a.sentiment - b.sentiment)[0];
  const openAlerts = data.alerts.filter((a) => a.status === "open").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-white">What is happening with Deriv right now?</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Reddit, YouTube, Google Play, web — AI-enriched by aspect, location, and user journey stage.
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-slate-800 bg-slate-900 p-0.5">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded px-2.5 py-1 text-xs ${d === days ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <DataSourcesCard />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label={`Mentions (${days}d)`}
          value={o.mentions.toLocaleString()}
          hint={HELP.mentions}
          sub={
            <span className={deltaMentions == null ? "" : deltaMentions >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {fmtDelta(deltaMentions)} vs prev
            </span>
          }
        />
        <Stat
          label="Weighted sentiment"
          value={o.weighted_sentiment.toFixed(3)}
          tone={toneClass(o.weighted_sentiment)}
          hint={HELP.weighted_sentiment}
          sub={
            <span className={deltaSent >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {deltaSent >= 0 ? "+" : ""}
              {deltaSent.toFixed(3)} vs prev
            </span>
          }
        />
        <Stat
          label="Negative share"
          value={`${((100 * o.negative) / Math.max(o.mentions, 1)).toFixed(0)}%`}
          tone="text-rose-400"
          hint={HELP.negative_share}
          sub={`${o.negative} neg · ${o.positive} pos · ${o.mixed} mixed`}
        />
        <Stat label="Countries tracked" value={data.countries.length} sub={`${o.located} mentions located`} hint={HELP.countries_tracked} />
        <Stat
          label="Open alerts"
          value={openAlerts}
          tone={openAlerts > 0 ? "text-rose-400" : "text-emerald-400"}
          hint={HELP.open_alerts}
          sub={
            <Link href="/alerts" className="underline">
              view alerts
            </Link>
          }
        />
      </div>

      <Card title={`Volume & sentiment — ${days} days (sentiment = engagement-weighted)`} hint={HELP.volume_sentiment}>
        <TrendChart data={data.series} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Sentiment by country (estimated location)"
          hint={HELP.sentiment_by_country}
          action={
            <Link href="/countries" className="text-xs text-sky-400 hover:underline">
              map →
            </Link>
          }
        >
          {data.countries.length === 0 && <EmptyHint>No country data yet</EmptyHint>}
          {data.countries.slice(0, 10).map((c) => (
            <BarRow
              key={c.key}
              label={c.key}
              value={c.mentions}
              max={maxCountry}
              right={
                <>
                  <span className={toneClass(c.sentiment)}>{c.sentiment.toFixed(2)}</span> · {c.mentions}
                </>
              }
              color={c.sentiment < -0.1 ? "#ef4444" : c.sentiment > 0.1 ? "#22c55e" : "#475569"}
            />
          ))}
        </Card>
        <Card title="Sentiment by platform" hint={HELP.sentiment_by_platform}>
          {data.sources.map((s) => (
            <BarRow
              key={s.key}
              label={s.key}
              value={s.mentions}
              max={maxSource}
              right={
                <>
                  <span className={toneClass(s.sentiment)}>{s.sentiment.toFixed(2)}</span> · {s.mentions}
                </>
              }
              color="#38bdf8"
            />
          ))}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          title="Journey funnel"
          hint={HELP.journey_funnel}
          action={
            <Link href="/funnel" className="text-xs text-sky-400 hover:underline">
              details →
            </Link>
          }
        >
          {data.funnel.map((f) => (
            <BarRow
              key={f.stage}
              label={f.stage}
              value={f.mentions}
              max={maxFunnel}
              right={<span className={toneClass(f.sentiment)}>{f.sentiment.toFixed(2)}</span>}
              color={f.sentiment < -0.1 ? "#ef4444" : f.sentiment > 0.1 ? "#22c55e" : "#475569"}
            />
          ))}
          {weakest && (
            <p className="mt-2 text-xs text-slate-500">
              Weakest stage: <span className="font-semibold text-rose-400">{weakest.stage}</span>
            </p>
          )}
        </Card>
        <Card title="Dominant negative aspects" hint={HELP.dominant_negative_aspects}>
          {data.aspects.length === 0 && <EmptyHint>No negative aspects yet</EmptyHint>}
          <ul className="space-y-1.5">
            {data.aspects.slice(0, 7).map((a, i) => (
              <li key={`${a.aspect}-${i}`} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">
                  {a.aspect} <span className="text-xs text-slate-600">{a.stage}</span>
                </span>
                <span className="text-xs font-medium text-rose-400">{a.negative}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Emerging topics (7d vs prev)" hint={HELP.emerging_topics}>
          {data.emerging.length === 0 && <EmptyHint>No rising trends yet</EmptyHint>}
          <ul className="space-y-1.5">
            {data.emerging.slice(0, 7).map((t) => (
              <li key={t.topic} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{t.topic}</span>
                <span className="text-xs text-slate-400">
                  {t.current} · <span className="text-amber-400">{fmtDelta(t.delta)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Local hour pattern — when do complaints happen? (color = sentiment)" hint={HELP.hourly_pattern}>
          <HourlyChart data={data.hourly} />
        </Card>
        <Card title="Evidence — highest-impact complaints" hint={HELP.evidence}>
          <div className="space-y-2.5">
            {data.evidence.length === 0 && <EmptyHint>No evidence yet</EmptyHint>}
            {data.evidence.map((m) => (
              <div key={m.id} className="rounded border border-slate-800 bg-slate-900/80 p-2.5 text-xs">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <SentimentPill sentiment={m.sentiment} />
                  <span className="text-slate-500">
                    {m.country ?? "?"} · {m.stage ?? "-"} · {m.source} · {m.published_at}
                  </span>
                  <span className="ml-auto">
                    <SourceLink m={m} label="open source" className="text-[10px]" />
                  </span>
                </div>
                <p className="line-clamp-2 text-slate-300">{m.content}</p>
                {m.language && !m.language.toLowerCase().startsWith("en") && (
                  <div className="mt-1">
                    <TranslateButton itemId={m.id} language={m.language} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
