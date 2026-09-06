"use client";

import { useEffect, useState } from "react";
import { Card, EmptyHint, Loading, Stat } from "@/components/ui";
import { HELP } from "@/lib/help";
import { getJson } from "@/lib/api";

interface CostResponse {
  daily: { day: string; cost: number; calls: number; input_tokens: number; output_tokens: number }[];
  total: number;
  byPurpose: { purpose: string; cost: number; calls: number }[];
}

export default function CostsPage() {
  const [data, setData] = useState<CostResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<CostResponse>("/api/costs")
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="text-sm text-rose-300">Failed to load: {error}</div>;
  if (!data) return <Loading />;

  const maxCost = Math.max(...data.daily.map((d) => d.cost), 0.000001);
  const monthly = (data.total / 14) * 30;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">LLM Cost Observability</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Every LLM request is logged per purpose/model/tokens. These numbers matter for the pitch: &quot;costs $X/month to run&quot;.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total (14 days)" value={`$${data.total.toFixed(4)}`} hint={HELP.llm_costs} />
        <Stat label="Projected / month" value={`$${monthly.toFixed(2)}`} tone="text-amber-400" hint={HELP.llm_costs} />
        <Stat label="Requests (14 days)" value={data.daily.reduce((s, d) => s + d.calls, 0).toLocaleString()} hint={HELP.llm_costs} />
        <Stat
          label="Tokens in / out"
          value={`${(data.daily.reduce((s, d) => s + d.input_tokens, 0) / 1e6).toFixed(1)}M / ${(data.daily.reduce((s, d) => s + d.output_tokens, 0) / 1e6).toFixed(1)}M`}
          hint={HELP.llm_costs}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Daily cost (14 days)" hint={HELP.llm_costs}>
          {data.daily.length === 0 && <EmptyHint>No LLM usage yet</EmptyHint>}
          {data.daily.map((d) => (
            <div key={d.day} className="flex items-center gap-3 py-1">
              <div className="w-20 shrink-0 text-xs text-slate-400">{d.day.slice(5)}</div>
              <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800/70">
                <div className="h-full rounded bg-sky-500/80" style={{ width: `${Math.max(1, (d.cost / maxCost) * 100)}%` }} />
              </div>
              <div className="w-32 shrink-0 text-right text-xs text-slate-400">
                ${d.cost.toFixed(4)} · {d.calls} calls
              </div>
            </div>
          ))}
        </Card>

        <Card title="Per purpose">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1.5 font-medium">Purpose</th>
                <th className="py-1.5 text-right font-medium">Calls</th>
                <th className="py-1.5 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.byPurpose.map((p) => (
                <tr key={p.purpose} className="border-t border-slate-800/60">
                  <td className="py-1.5 text-slate-200">{p.purpose}</td>
                  <td className="py-1.5 text-right text-slate-400">{p.calls}</td>
                  <td className="py-1.5 text-right text-slate-300">${p.cost.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.byPurpose.length === 0 && <EmptyHint>No data yet</EmptyHint>}
        </Card>
      </div>
    </div>
  );
}
