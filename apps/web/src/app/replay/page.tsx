"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, EmptyHint, Loading, Stat } from "@/components/ui";
import { WorldMap } from "@/components/world-map";
import { HELP } from "@/lib/help";
import { getJson, type ReplayBucket } from "@/lib/api";

interface ReplayResponse {
  bucket_hours: number;
  buckets: string[];
  data: ReplayBucket[];
}

export default function ReplayPage() {
  const [days, setDays] = useState(30);
  const [bucket, setBucket] = useState(6);
  const [replay, setReplay] = useState<ReplayResponse | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getJson<ReplayResponse>(`/api/replay?days=${days}&bucket=${bucket}`)
      .then((r) => {
        setReplay(r);
        setIndex(Math.max(0, r.buckets.length - 1));
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [days, bucket]);

  useEffect(() => {
    if (!playing || !replay) return;
    const t = setInterval(() => {
      setIndex((i) => {
        if (i >= replay.buckets.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 800);
    return () => clearInterval(t);
  }, [playing, replay]);

  const frame = useMemo(() => {
    if (!replay) return { data: [], bucket: "", total: 0, sentiment: 0 };
    const b = replay.buckets[index] ?? "";
    const rows = replay.data.filter((d) => d.bucket === b);
    const total = rows.reduce((s, r) => s + r.mentions, 0);
    const wSum = rows.reduce((s, r) => s + r.mentions, 0) || 1;
    const sentiment = rows.reduce((s, r) => s + r.sentiment * r.mentions, 0) / wSum;
    return { data: rows.map((r) => ({ country: r.country, mentions: r.mentions, sentiment: r.sentiment })), bucket: b, total, sentiment };
  }, [replay, index]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Timeline Replay</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Scrub through time and watch how sentiment moves across countries. Red = negative, green = positive.
          </p>
        </div>
        <div className="flex gap-2">
          <select value={bucket} onChange={(e) => setBucket(Number(e.target.value))} className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300">
            <option value={1}>1h buckets</option>
            <option value={3}>3h buckets</option>
            <option value={6}>6h buckets</option>
            <option value={12}>12h buckets</option>
            <option value={24}>24h buckets</option>
          </select>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300">
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      {error && <div className="text-sm text-rose-300">Failed: {error}</div>}
      {loading && <Loading label="Loading timeline…" />}
      {replay && replay.buckets.length === 0 && !loading && <EmptyHint>No located mentions in this window yet.</EmptyHint>}

      {replay && replay.buckets.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Bucket" value={frame.bucket.replace("T", " ") || "—"} hint={HELP.map_country} />
            <Stat label="Mentions in bucket" value={frame.total} hint={HELP.mentions} />
            <Stat
              label="Weighted sentiment"
              value={frame.sentiment.toFixed(2)}
              tone={frame.sentiment > 0.05 ? "text-emerald-400" : frame.sentiment < -0.05 ? "text-rose-400" : "text-slate-300"}
              hint={HELP.weighted_sentiment}
            />
          </div>

          <Card>
            <WorldMap data={frame.data} />
          </Card>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (index >= replay.buckets.length - 1) setIndex(0);
                setPlaying((p) => !p);
              }}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              {playing ? "Pause" : "Play"}
            </button>
            <input
              type="range"
              min={0}
              max={replay.buckets.length - 1}
              value={index}
              onChange={(e) => {
                setPlaying(false);
                setIndex(Number(e.target.value));
              }}
              className="h-1.5 flex-1 accent-sky-500"
            />
            <span className="w-12 text-right text-xs text-slate-500">
              {index + 1}/{replay.buckets.length}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
