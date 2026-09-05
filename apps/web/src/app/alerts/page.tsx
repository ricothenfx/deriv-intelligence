"use client";

import { useEffect, useState } from "react";
import { Card, EmptyHint, Loading, SeverityBadge, toneClass } from "@/components/ui";
import { getJson, type AlertRow } from "@/lib/api";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    getJson<{ alerts: AlertRow[] }>("/api/alerts")
      .then((r) => {
        setAlerts(r.alerts);
        setExpanded(r.alerts[0]?.id ?? null);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const refresh = () => {
    getJson<{ alerts: AlertRow[] }>("/api/alerts").then((r) => setAlerts(r.alerts)).catch(() => {});
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-white">Crisis Alerts</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Z-score anomaly detection (volume & sentiment per country/topic) + severity + incident timeline. Automatic Telegram notifications for high/critical.
          </p>
        </div>
        <button onClick={refresh} className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
          Refresh
        </button>
      </div>

      {error && <div className="text-sm text-rose-300">Failed to load: {error}</div>}
      {!alerts && !error && <Loading />}
      {alerts && alerts.length === 0 && (
        <EmptyHint>No alerts yet. Run `pnpm --filter @deriv-intel/worker report anomaly` or wait for the hourly anomaly cron.</EmptyHint>
      )}

      <div className="space-y-3">
        {alerts?.map((a) => (
          <Card key={a.id} className={expanded === a.id ? "border-slate-700" : ""}>
            <div
              className="flex cursor-pointer flex-wrap items-center gap-2"
              onClick={() => setExpanded(expanded === a.id ? null : a.id)}
            >
              <SeverityBadge severity={a.severity} />
              <span className="font-medium text-slate-200">#{a.id} {a.scope}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${a.status === "open" ? "bg-rose-500/15 text-rose-300" : "bg-slate-700/40 text-slate-400"}`}>
                {a.status}
              </span>
              <span className="ml-auto text-xs text-slate-500">{a.created_at}</span>
            </div>

            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
              <span>
                metric <span className="text-slate-200">{a.metric}</span>
              </span>
              <span>
                observed <span className="font-semibold text-slate-100">{a.observed.toFixed(2)}</span> vs baseline{" "}
                {a.baseline.toFixed(2)}
              </span>
              <span>
                z <span className={toneClass(-Math.abs(a.z_score))}>{a.z_score.toFixed(2)}</span>
              </span>
              <span>confidence {(a.confidence * 100).toFixed(0)}%</span>
            </div>

            {expanded === a.id && (
              <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
                {a.explanation && (
                  <p className="text-xs leading-relaxed text-slate-300">
                    <span className="font-medium text-slate-200">AI explanation: </span>
                    {a.explanation}
                  </p>
                )}
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-400">Incident timeline</div>
                  <ol className="relative space-y-3 border-l border-slate-800 pl-4">
                    {a.timeline.map((t, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-sky-500" />
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">
                          {t.event} · {t.at.replace("T", " ").slice(0, 16)}
                        </div>
                        <div className="text-xs text-slate-300">{t.detail}</div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
