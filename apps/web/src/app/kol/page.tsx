"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Card, EmptyHint, InfoTip, Loading, toneClass } from "@/components/ui";
import { HELP } from "@/lib/help";
import { getJson, type KolRow } from "@/lib/api";

export default function KolPage() {
  const [days, setDays] = useState(30);
  const [authors, setAuthors] = useState<KolRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getJson<{ authors: KolRow[] }>(`/api/kol?days=${days}&limit=40`)
      .then((r) => setAuthors(r.authors))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">KOL Radar</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Authors ranked by influence: posting frequency × engagement reach × negative impact. High-score negative authors are reputation risks; positive ones are advocacy candidates.
          </p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300">
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

      {error && <div className="text-sm text-rose-300">Failed: {error}</div>}
      {loading && <Loading label="Scanning authors…" />}
      {authors && authors.length === 0 && !loading && (
        <EmptyHint>No authors yet — data appears once mentions are collected.</EmptyHint>
      )}

      {authors && authors.length > 0 && (
        <Card title={`Top ${authors.length} authors`} hint={HELP.kol_score}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">
                    Author <InfoTip text={HELP.kol_profile} />
                  </th>
                  <th className="pb-2 font-medium">Platform</th>
                  <th className="pb-2 font-medium">
                    Score <InfoTip text={HELP.kol_score} />
                  </th>
                  <th className="pb-2 font-medium">Posts</th>
                  <th className="pb-2 font-medium">Engagement</th>
                  <th className="pb-2 font-medium">Avg sent.</th>
                  <th className="pb-2 font-medium">Neg. share</th>
                  <th className="pb-2 font-medium">Countries</th>
                  <th className="pb-2 font-medium">Topics</th>
                  <th className="pb-2 font-medium">
                    Last active <InfoTip text={HELP.kol_example} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {authors.map((a, i) => (
                  <tr key={`${a.source}:${a.author}`} className="border-t border-slate-800/60">
                    <td className="py-1.5 text-slate-600">{i + 1}</td>
                    <td className="max-w-40 truncate py-1.5 font-medium">
                      {a.profile_url ? (
                        <a
                          href={a.profile_url}
                          target="_blank"
                          rel="noreferrer"
                          title={`Buka profil ${a.author} di tab baru`}
                          className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 hover:underline"
                        >
                          {a.author}
                          <ExternalLink size={11} className="shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-200" title={a.author}>
                          {a.author}
                          {a.example_url && (
                            <a
                              href={a.example_url}
                              target="_blank"
                              rel="noreferrer"
                              title="Buka contoh postingan terbaru author ini"
                              className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-normal text-sky-400/80 hover:text-sky-300 hover:underline"
                            >
                              postingan
                              <ExternalLink size={9} className="shrink-0" />
                            </a>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-slate-400">{a.source}</td>
                    <td className="py-1.5 font-semibold text-sky-300">{a.score}</td>
                    <td className="py-1.5 text-slate-300">{a.mentions}</td>
                    <td className="py-1.5 text-slate-300">{Math.round(a.total_engagement)}</td>
                    <td className={`py-1.5 ${toneClass(a.avg_sentiment)}`}>{a.avg_sentiment.toFixed(2)}</td>
                    <td className={`py-1.5 ${a.negative_share > 0.5 ? "text-rose-400" : "text-slate-400"}`}>
                      {(a.negative_share * 100).toFixed(0)}%
                    </td>
                    <td className="py-1.5 text-slate-400">{a.countries.slice(0, 3).join(",") || "—"}</td>
                    <td className="max-w-44 truncate py-1.5 text-sky-300/80" title={a.topics.join(", ")}>{a.topics.join(", ") || "—"}</td>
                    <td className="py-1.5 text-slate-500">
                      {a.last_active ?? "—"}
                      {a.profile_url && a.example_url && (
                        <a
                          href={a.example_url}
                          target="_blank"
                          rel="noreferrer"
                          title="Buka postingan terbaru author ini di tab baru"
                          className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-sky-400/80 hover:text-sky-300 hover:underline"
                        >
                          postingan
                          <ExternalLink size={9} className="shrink-0" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
