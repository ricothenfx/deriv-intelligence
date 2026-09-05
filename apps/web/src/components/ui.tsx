import React from "react";

export function Card({
  title,
  children,
  className = "",
  action,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-900/60 p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-slate-300">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "text-white",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function BarRow({
  label,
  value,
  max,
  right,
  color = "#38bdf8",
  onClick,
}: {
  label: React.ReactNode;
  value: number;
  max: number;
  right?: React.ReactNode;
  color?: string;
  onClick?: () => void;
}) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div
      className={`flex items-center gap-3 py-1 ${onClick ? "cursor-pointer hover:bg-slate-900/60 rounded" : ""}`}
      onClick={onClick}
    >
      <div className="w-16 shrink-0 text-xs font-medium text-slate-300">{label}</div>
      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800/70">
        <div className="h-full rounded" style={{ width: `${w}%`, background: color }} />
      </div>
      {right && <div className="w-32 shrink-0 text-right text-xs text-slate-400">{right}</div>}
    </div>
  );
}

const SENT_TONE: Record<string, string> = {
  positive: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
  negative: "border-rose-500/30 bg-rose-500/15 text-rose-400",
  neutral: "border-slate-500/30 bg-slate-500/15 text-slate-400",
  mixed: "border-amber-500/30 bg-amber-500/15 text-amber-400",
};

export function SentimentPill({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return <span className="text-xs text-slate-600">—</span>;
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${SENT_TONE[sentiment] ?? SENT_TONE.neutral}`}>
      {sentiment}
    </span>
  );
}

const SEV_TONE: Record<string, string> = {
  critical: "border-rose-500 bg-rose-500/20 text-rose-300",
  high: "border-orange-500 bg-orange-500/20 text-orange-300",
  medium: "border-amber-500 bg-amber-500/15 text-amber-300",
  low: "border-slate-500 bg-slate-500/15 text-slate-300",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEV_TONE[severity] ?? SEV_TONE.low}`}>
      {severity}
    </span>
  );
}

export function toneClass(s: number): string {
  return s > 0.08 ? "text-emerald-400" : s < -0.08 ? "text-rose-400" : "text-slate-400";
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="py-10 text-center text-sm text-slate-500">{label}</div>;
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="py-6 text-center text-xs text-slate-600">{children}</div>;
}
