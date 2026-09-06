"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, RotateCcw, Save, X } from "lucide-react";
import { Card, EmptyHint, InfoTip, Loading } from "@/components/ui";
import { HELP } from "@/lib/help";
import { getJson, type KeywordsResponse, type KeywordSourceConfig } from "@/lib/api";

type Method = "PUT" | "DELETE";

async function sendKeywords(method: Method, source: string, queries?: string[]): Promise<KeywordsResponse> {
  const res = await fetch(method === "PUT" ? "/api/keywords" : `/api/keywords?source=${encodeURIComponent(source)}`, {
    method,
    ...(method === "PUT"
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, queries }) }
      : {}),
  });
  if (!res.ok) throw new Error(`${method} /api/keywords -> ${res.status}: ${await res.text()}`);
  return res.json() as Promise<KeywordsResponse>;
}

function SourceKeywords({
  cfg,
  onChanged,
}: {
  cfg: KeywordSourceConfig;
  onChanged: (sources: KeywordSourceConfig[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(cfg.queries);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(cfg.queries);
  }, [cfg.queries]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(cfg.queries);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    if (!draft.some((q) => q.toLowerCase() === value.toLowerCase())) setDraft([...draft, value]);
    setInput("");
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await sendKeywords("PUT", cfg.source, draft);
      onChanged(res.sources);
      setSaved(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await sendKeywords("DELETE", cfg.source);
      onChanged(res.sources);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title={cfg.label}
      hint={HELP.keywords_page}
      action={
        <div className="flex items-center gap-2">
          {saved && !dirty && <span className="text-[10px] text-emerald-400">saved ✓</span>}
          <button
            onClick={reset}
            disabled={busy || !cfg.configured}
            title="Restore the environment defaults"
            className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            <RotateCcw size={10} />
            Reset to defaults
          </button>
          <button
            onClick={save}
            disabled={busy || !dirty}
            className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-sky-500 disabled:opacity-40"
          >
            <Save size={11} />
            {busy ? "saving…" : "Save"}
          </button>
        </div>
      }
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        {draft.length === 0 && (
          <span className="text-[11px] italic text-slate-500">
            No keywords — this channel will not fetch anything until you add at least one.
          </span>
        )}
        {draft.map((q, i) => (
          <span
            key={q}
            className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800/60 py-0.5 pl-2 pr-1 text-[11px] text-slate-200"
          >
            <span className="text-slate-600">{i + 1}.</span>
            {q}
            <button
              onClick={() => setDraft(draft.filter((x) => x !== q))}
              title="Remove keyword"
              className="rounded p-0.5 text-slate-500 hover:bg-slate-700 hover:text-rose-300"
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>

      <form onSubmit={add} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Add a keyword for ${cfg.label} (e.g. "Deriv withdrawal")…`}
          className="flex-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-sky-300 hover:bg-slate-800 disabled:opacity-40"
        >
          <Plus size={11} />
          Add
        </button>
      </form>

      {error && <div className="mt-2 text-[11px] text-rose-300">{error}</div>}

      <div className="mt-2 text-[10px] leading-relaxed text-slate-500">
        <InfoTip text={HELP.keywords_edit} />
        {cfg.configured
          ? "Custom keyword set — replaces the environment defaults. "
          : "Using environment defaults — not yet customized. "}
        Changes take effect on the next scheduled or manual grab.
        {cfg.source === "youtube" && " YouTube runs keywords in order until the daily quota is used up — put the most important ones first."}
      </div>
    </Card>
  );
}

export default function KeywordsPage() {
  const [sources, setSources] = useState<KeywordSourceConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<KeywordsResponse>("/api/keywords")
      .then((r) => setSources(r.sources))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Search Keywords</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          The keywords actively used to collect data per channel. Edit them to tune coverage — add product aliases
          (Deriv MT5, DBot, Binary.com), local-language terms (Deriv wd, Deriv penarikan), or competitor names for
          benchmarking.
        </p>
      </div>

      {error && <div className="text-sm text-rose-300">Failed: {error}</div>}
      {!sources && !error && <Loading label="Loading keywords…" />}
      {sources && sources.length === 0 && <EmptyHint>No keyword-configurable channels.</EmptyHint>}

      <div className="space-y-4">
        {sources?.map((cfg) => (
          <SourceKeywords key={cfg.source} cfg={cfg} onChanged={setSources} />
        ))}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-[11px] leading-relaxed text-slate-400">
        <span className="font-medium text-slate-300">Google Play</span> collects app reviews for a fixed app ID
        (com.deriv.app) across configured countries — it has no search keywords. Use{" "}
        <code className="rounded bg-slate-800 px-1">GPLAY_COUNTRIES</code> in <code className="rounded bg-slate-800 px-1">.env</code>{" "}
        to change its coverage.
      </div>
    </div>
  );
}
