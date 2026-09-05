"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Card, EmptyHint, Loading, SentimentPill, toneClass } from "@/components/ui";
import { getJson, postJson, type ChatLogEntry, type GroupStat, type MentionRow } from "@/lib/api";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  tools?: ChatLogEntry[];
}

const SUGGESTIONS = [
  "What is happening with Deriv right now?",
  "Which country has the most withdrawal complaints this week?",
  "At which journey stage are users most stuck, and why?",
  "Compare sentiment during working hours vs midnight",
];

export default function SearchPage() {
  const [tab, setTab] = useState<"search" | "ask">("search");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Hybrid Search & Ask Your Market</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Keyword (Postgres FTS) + semantic (pgvector) search with metadata filters — plus an analytics chat with tool access to aggregations.
        </p>
      </div>

      <div className="flex gap-1 rounded-md border border-slate-800 bg-slate-900 p-0.5 w-fit">
        {(["search", "ask"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1.5 text-xs ${tab === t ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            {t === "search" ? "Search" : "Ask your market"}
          </button>
        ))}
      </div>

      {tab === "search" ? <SearchTab /> : <AskTab />}
    </div>
  );
}

function SearchTab() {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [source, setSource] = useState("");
  const [days, setDays] = useState(30);
  const [countries, setCountries] = useState<GroupStat[]>([]);
  const [results, setResults] = useState<MentionRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ countries: GroupStat[] }>("/api/countries?days=30")
      .then((r) => setCountries(r.countries))
      .catch(() => {});
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ days: String(days), limit: "40" });
    if (q.trim()) params.set("q", q.trim());
    if (country) params.set("country", country);
    if (sentiment) params.set("sentiment", sentiment);
    if (source) params.set("source", source);
    getJson<{ results: MentionRow[] }>(`/api/search?${params}`)
      .then((r) => setResults(r.results))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='e.g. "withdrawal delay Nigeria" or "wd lama"…'
          className="min-w-64 flex-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
        />
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-md border border-slate-800 bg-slate-900 px-2 py-2 text-xs text-slate-300">
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c.key} value={c.key}>{c.key}</option>
          ))}
        </select>
        <select value={sentiment} onChange={(e) => setSentiment(e.target.value)} className="rounded-md border border-slate-800 bg-slate-900 px-2 py-2 text-xs text-slate-300">
          <option value="">All sentiments</option>
          <option value="negative">negative</option>
          <option value="positive">positive</option>
          <option value="neutral">neutral</option>
          <option value="mixed">mixed</option>
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-md border border-slate-800 bg-slate-900 px-2 py-2 text-xs text-slate-300">
          <option value="">All platforms</option>
          <option value="reddit">reddit</option>
          <option value="youtube">youtube</option>
          <option value="gplay">gplay</option>
          <option value="tavily">tavily</option>
        </select>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-md border border-slate-800 bg-slate-900 px-2 py-2 text-xs text-slate-300">
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
        <button type="submit" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500">
          Search
        </button>
      </form>

      {error && <div className="text-sm text-rose-300">Failed: {error}</div>}
      {loading && <Loading label="Searching (embed + FTS + fusion)…" />}
      {results && results.length === 0 && !loading && <EmptyHint>No results — try widening the filters or date range.</EmptyHint>}

      <div className="space-y-2">
        {results?.map((m) => (
          <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <SentimentPill sentiment={m.sentiment} />
              <span className="text-slate-500">
                {m.country ?? "?"} · {m.stage ?? "-"} · {m.source} · {m.published_at}
              </span>
              {m.topics.slice(0, 3).map((t) => (
                <span key={t} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-sky-300">{t}</span>
              ))}
              <span className="ml-auto text-[10px] text-slate-600">score {(m.score ?? 0).toFixed(3)}</span>
            </div>
            <p className="line-clamp-3 text-slate-300">{m.content}</p>
            {m.url && (
              <a href={m.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-sky-400 hover:underline">
                open source →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AskTab() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    setError(null);
    const next: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await postJson<{ answer: string; toolCalls: ChatLogEntry[]; model: string }>("/api/chat", {
        messages: next.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages([...next, { role: "assistant", content: res.answer, tools: res.toolCalls }]);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="min-h-96">
        {messages.length === 0 && (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-slate-400">Ask anything about market perception of Deriv — the AI will call aggregation & search tools to answer with real numbers.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-sky-600 hover:text-sky-300">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              <div
                className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user" ? "bg-sky-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-200"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.tools && m.tools.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-800 pt-2">
                    {m.tools.map((t, k) => (
                      <span key={k} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400" title={JSON.stringify(t.args)}>
                        {t.name} · {t.summary}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="text-xs text-slate-500">thinking… (calling aggregation / search tools)</div>}
        </div>
        <div ref={bottomRef} />
      </Card>

      {error && <div className="text-sm text-rose-300">Failed: {error}</div>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the market… (e.g. why is sentiment in Nigeria dropping?)"
          className="flex-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
        />
        <button type="submit" disabled={busy} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
