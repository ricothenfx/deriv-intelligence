"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { InfoTip } from "@/components/ui";
import { getJson, postJson, type FetchJobStatus, type SourceStatus } from "@/lib/api";

interface SourcesResponse {
  sources: SourceStatus[];
  pending_enrichment: number;
}

interface JobUi extends FetchJobStatus {
  startedAt: number;
}

const EMPTY_JOB: Pick<JobUi, "fetched" | "inserted" | "error"> = { fetched: null, inserted: null, error: null };

function relTime(iso: string | null): string {
  if (!iso) return "belum pernah";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

const STAGE_LABEL: Record<string, string> = {
  waiting: "menunggu worker…",
  active: "sedang mengambil data…",
  delayed: "menunggu worker…",
  completed: "selesai",
  failed: "gagal",
};

const isRunning = (j: JobUi | undefined): boolean =>
  !!j && (j.state === "waiting" || j.state === "active" || j.state === "delayed");

export function DataSourcesCard() {
  const [data, setData] = useState<SourcesResponse | null>(null);
  const [jobs, setJobs] = useState<Record<string, JobUi>>({});
  const [error, setError] = useState<string | null>(null);
  const [grabbing, setGrabbing] = useState<string | null>(null);
  const jobsRef = useRef<Record<string, JobUi>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    if (!Object.values(jobs).some((j) => isRunning(j))) return;
    const t = setTimeout(() => setTick((n) => n + 1), 1000);
    return () => clearTimeout(t);
  }, [tick, jobs]);

  const loadSources = useCallback(() => {
    getJson<SourcesResponse>("/api/sources")
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadSources();
    const t = setInterval(loadSources, 30000);
    return () => clearInterval(t);
  }, [loadSources]);

  const pollJobs = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const active = Object.values(jobsRef.current).filter((j) => isRunning(j));
      if (active.length === 0) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        return;
      }
      let changed = false;
      for (const j of active) {
        try {
          const st = await getJson<FetchJobStatus>(`/api/fetch?jobId=${encodeURIComponent(j.jobId)}`);
          setJobs((prev) => ({ ...prev, [j.jobId]: { ...prev[j.jobId], ...st } }));
          if (st.state === "completed" || st.state === "failed") changed = true;
        } catch {
          setJobs((prev) => {
            const cur = prev[j.jobId];
            if (!cur || !isRunning(cur)) return prev;
            return { ...prev, [j.jobId]: { ...cur, state: "failed", error: "worker/Redis tidak terjangkau" } };
          });
          changed = true;
        }
      }
      if (changed) loadSources();
    }, 3000);
  }, [loadSources]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const grab = async (source: string) => {
    if (grabbing) return;
    setGrabbing(source);
    setError(null);
    try {
      const res = await postJson<{ jobs: { jobId: string; source: string }[] }>("/api/fetch", { source });
      const now = Date.now();
      setJobs((prev) => {
        const next = { ...prev };
        for (const j of res.jobs) {
          next[j.jobId] = { jobId: j.jobId, source: j.source, state: "waiting", startedAt: now, ...EMPTY_JOB };
        }
        return next;
      });
      pollJobs();
    } catch (e) {
      setError(String(e));
    } finally {
      setGrabbing(null);
    }
  };

  const latestJob = (source: string): JobUi | undefined =>
    Object.values(jobs)
      .filter((j) => j.source === source)
      .sort((a, b) => b.startedAt - a.startedAt)[0];

  const anyRunning = Object.values(jobs).some((j) => isRunning(j));

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-300">
          Sumber data &amp; kesegaran
          <InfoTip text="Status pengambilan data per channel: kapan terakhir di-grab, jadwal otomatis (cron), dan tombol untuk mengambil data terbaru sekarang tanpa menunggu jadwal. Job dikirim ke worker (pnpm dev:worker) — hasil muncul beberapa saat setelah selesai." />
        </h3>
        <button
          onClick={() => grab("all")}
          disabled={!!grabbing || anyRunning}
          className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          <RefreshCw size={12} className={anyRunning ? "animate-spin" : ""} />
          {anyRunning ? "mengambil…" : "Grab semua channel"}
        </button>
      </div>

      {error && (
        <div className="mb-2 rounded border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-300">
          {error} — pastikan Redis (`pnpm docker:up`) dan worker (`pnpm dev:worker`) berjalan.
        </div>
      )}
      {!data && <div className="py-4 text-center text-xs text-slate-500">memuat status sumber…</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {data.sources.map((s) => {
              const job = latestJob(s.source);
              const running = isRunning(job);
              const done = job?.state === "completed";
              const failed = job?.state === "failed";
              const stuck = running && job && Date.now() - job.startedAt > 45000;
              return (
                <div key={s.source} className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">{s.label}</span>
                    <button
                      onClick={() => grab(s.source)}
                      disabled={!!grabbing || anyRunning}
                      title="Ambil data terbaru dari channel ini sekarang juga"
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium text-sky-300 hover:bg-slate-800 disabled:opacity-40"
                    >
                      <RefreshCw size={10} className={running ? "animate-spin" : ""} />
                      Grab now
                    </button>
                  </div>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                    <div>
                      Terakhir grab: <span className="text-slate-200">{relTime(s.last_grab)}</span>
                      {s.new_items > 0 && <span className="ml-1 text-emerald-400">(+{s.new_items} baru)</span>}
                    </div>
                    <div>
                      Jadwal otomatis: <span className="text-slate-300">{s.schedule}</span>
                    </div>
                    <div>
                      Total item: <span className="text-slate-300">{s.items.toLocaleString()}</span>
                    </div>
                    {s.quota_used != null && s.quota_budget != null && (
                      <div className={s.quota_used / s.quota_budget > 0.85 ? "text-amber-400" : ""}>
                        Kuota API hari ini: {s.quota_used.toLocaleString()}/{s.quota_budget.toLocaleString()}
                      </div>
                    )}
                  </div>
                  {job && (
                    <div
                      className={`mt-2 border-t border-slate-800 pt-1.5 text-[10px] ${
                        failed ? "text-rose-400" : done ? "text-emerald-400" : "text-sky-300"
                      }`}
                    >
                      {running && STAGE_LABEL[job.state]}
                      {stuck && " — worker belum mengambil job; pastikan `pnpm dev:worker` berjalan"}
                      {done && `selesai: ${job.fetched ?? 0} diambil, ${job.inserted ?? 0} baru`}
                      {failed && `gagal: ${job.error ?? "unknown"}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-[10px] text-slate-500">
            Setelah grab, AI enrichment berjalan di latar belakang
            {data.pending_enrichment > 0 && <> — {data.pending_enrichment.toLocaleString()} item sedang menunggu dianalisis</>};
            angka analitik bertambah bertahap sampai antrean selesai.
          </div>
        </>
      )}
    </div>
  );
}
