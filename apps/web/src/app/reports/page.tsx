"use client";

import { useEffect, useState } from "react";
import { Card, EmptyHint, Loading } from "@/components/ui";
import { getJson, postJson } from "@/lib/api";

interface ReportRow {
  id: number;
  period_start: string;
  period_end: string;
  summary: string | null;
  file_path: string | null;
  sent: boolean;
  created_at: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    getJson<{ reports: ReportRow[] }>("/api/reports")
      .then((r) => setReports(r.reports))
      .catch((e) => setError(String(e)));
  };

  useEffect(load, []);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/reports", {});
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-white">Weekly Reports</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Automatic PDF report every Monday 06:00 (worker cron): summary, top issues, weekly delta, evidence, AI recommendations + Telegram delivery.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? "Generating (LLM + PDF)…" : "Generate now"}
        </button>
      </div>

      {error && <div className="text-sm text-rose-300">Failed: {error}</div>}
      {!reports && !error && <Loading />}
      {reports && reports.length === 0 && (
        <EmptyHint>
          No reports yet. Click &quot;Generate now&quot; (requires an active LLM_API_KEY) or run `pnpm report` in the worker.
        </EmptyHint>
      )}

      <div className="space-y-3">
        {reports?.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-200">Report #{r.id}</span>
              <span className="text-xs text-slate-500">
                period {r.period_start} to {r.period_end}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${r.sent ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/40 text-slate-400"}`}
              >
                {r.sent ? "sent" : "not sent"}
              </span>
              <span className="ml-auto text-xs text-slate-500">{r.created_at}</span>
            </div>
            {r.summary && <p className="mt-2 text-xs leading-relaxed text-slate-300">{r.summary}</p>}
            {r.file_path && (
              <p className="mt-2 text-[11px] text-slate-500">
                PDF: <span className="text-sky-400">{r.file_path}</span>
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
