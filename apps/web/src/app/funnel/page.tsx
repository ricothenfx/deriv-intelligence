"use client";

import { useEffect, useState } from "react";
import { Card, EmptyHint, Loading, SentimentPill, SourceLink, toneClass } from "@/components/ui";
import { TranslateButton } from "@/components/translate";
import { HELP } from "@/lib/help";
import { getJson, type AspectRow, type FunnelRow, type GroupStat, type MentionRow } from "@/lib/api";

interface FunnelResponse {
  funnel: FunnelRow[];
  aspects: AspectRow[];
  evidence: MentionRow[];
}

const STAGE_DESC: Record<string, string> = {
  signup: "signup & first impression",
  kyc: "identity verification",
  deposit: "funding the account",
  trading: "execution & trading experience",
  withdrawal: "withdrawing funds",
  support: "customer service & account",
};

export default function FunnelPage() {
  const [country, setCountry] = useState("");
  const [countries, setCountries] = useState<GroupStat[]>([]);
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ countries: GroupStat[] }>("/api/countries?days=30")
      .then((r) => setCountries(r.countries))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    getJson<FunnelResponse>(`/api/funnel?days=7${country ? `&country=${country}` : ""}`)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [country]);

  const stageAspects = (stage: string) =>
    (data?.aspects ?? []).filter((a) => a.stage === stage).slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-white">User Journey Funnel</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Where in the journey are users most stuck? Sentiment per stage: signup → KYC → deposit → trading → withdrawal → support.
          </p>
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
        <>
          <Card title="Sentiment funnel (7 days)" hint={HELP.journey_funnel}>
            <div className="space-y-3">
              {data.funnel.map((f) => {
                const max = Math.max(...data.funnel.map((x) => x.mentions), 1);
                const w = Math.max(6, (f.mentions / max) * 100);
                const color = f.sentiment < -0.1 ? "#ef4444" : f.sentiment > 0.1 ? "#22c55e" : "#475569";
                const negShare = f.mentions > 0 ? (100 * f.negative) / f.mentions : 0;
                return (
                  <div key={f.stage} className="flex items-center gap-3">
                    <div className="w-24 shrink-0 text-right">
                      <div className="text-sm font-medium text-slate-200">{f.stage}</div>
                      <div className="text-[10px] text-slate-600">{STAGE_DESC[f.stage]}</div>
                    </div>
                    <div className="flex-1">
                      <div className="h-9 w-full rounded bg-slate-900/70 p-1">
                        <div
                          className="flex h-full items-center rounded px-2 text-[11px] font-medium text-white/90"
                          style={{ width: `${w}%`, background: color, opacity: 0.9 }}
                        >
                          {f.mentions} mentions
                        </div>
                      </div>
                      <div className="mt-1 flex gap-3 text-[11px] text-slate-500">
                        <span>
                          sentiment <span className={`font-medium ${toneClass(f.sentiment)}`}>{f.sentiment.toFixed(3)}</span>
                        </span>
                        <span>
                          negative <span className="text-rose-400">{negShare.toFixed(0)}%</span>
                        </span>
                        <span className="text-slate-600">
                          {stageAspects(f.stage).map((a) => a.aspect).join(", ") || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Complaints by aspect × stage" hint={HELP.funnel_aspect}>
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1.5 font-medium">Stage</th>
                    <th className="py-1.5 font-medium">Aspect</th>
                    <th className="py-1.5 text-right font-medium">Complaints</th>
                  </tr>
                </thead>
                <tbody>
                  {data.aspects.map((a, i) => (
                    <tr key={i} className="border-t border-slate-800/60">
                      <td className="py-1.5 text-slate-500">{a.stage ?? "-"}</td>
                      <td className="py-1.5 font-medium text-slate-200">{a.aspect}</td>
                      <td className="py-1.5 text-right text-rose-400">{a.negative}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.aspects.length === 0 && <EmptyHint>No aspect data yet</EmptyHint>}
            </Card>

            <Card title="Complaint evidence by stage" hint={HELP.evidence}>
              <div className="space-y-2">
                {data.evidence.length === 0 && <EmptyHint>No evidence yet</EmptyHint>}
                {data.evidence.slice(0, 8).map((m) => (
                  <div key={m.id} className="rounded border border-slate-800 bg-slate-900/80 p-2.5 text-xs">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <SentimentPill sentiment={m.sentiment} />
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-sky-300">{m.stage ?? "-"}</span>
                      <span className="text-slate-500">
                        {m.country ?? "?"} · {m.source} · {m.published_at}
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
        </>
      )}
    </div>
  );
}
