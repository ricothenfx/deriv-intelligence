"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Globe2,
  Filter,
  Radar,
  MessageSquareWarning,
  Search,
  FileText,
  Wallet,
  Scale,
  Users,
  Tags,
  PlayCircle,
  LineChart,
  HelpCircle,
  BookOpen,
} from "lucide-react";

const items = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/countries", label: "Countries", icon: Globe2 },
  { href: "/funnel", label: "Journey Funnel", icon: Filter },
  { href: "/topics", label: "Topics & Trends", icon: Radar },
  { href: "/alerts", label: "Crisis Alerts", icon: MessageSquareWarning },
  { href: "/competitors", label: "Benchmark", icon: Scale },
  { href: "/kol", label: "KOL Radar", icon: Users },
  { href: "/versions", label: "App Versions", icon: Tags },
  { href: "/replay", label: "Timeline Replay", icon: PlayCircle },
  { href: "/insights", label: "Insights", icon: LineChart },
  { href: "/faq", label: "Auto-FAQ", icon: HelpCircle },
  { href: "/search", label: "Search & Ask", icon: Search },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/costs", label: "LLM Costs", icon: Wallet },
  { href: "/help", label: "Panduan", icon: BookOpen },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-slate-800 p-4">
      <div className="px-2 pb-4 pt-1">
        <div className="text-base font-semibold text-white">Deriv Intelligence</div>
        <div className="text-[11px] text-slate-500">Global perception monitor</div>
      </div>
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
              active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
      <div className="mt-auto px-2 text-[10px] text-slate-600">internal pitch build v0.1</div>
    </aside>
  );
}
