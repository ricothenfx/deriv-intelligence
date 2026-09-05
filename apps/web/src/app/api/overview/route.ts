import { NextRequest, NextResponse } from "next/server";
import {
  byCountry,
  bySource,
  emergingTopics,
  funnelStats,
  hourlySentiment,
  listAlerts,
  overviewStats,
  timeseriesDaily,
  topMentions,
  topNegativeAspects,
} from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const days = Math.min(Math.max(Number(sp.get("days") ?? 7), 1), 90);
  const country = sp.get("country");
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  const prevFrom = new Date(Date.now() - 2 * days * 86400_000).toISOString();
  const filters = { country, from };

  const [overview, prev, series, countries, sources, hourly, emerging, funnel, aspects, alerts, evidence] =
    await Promise.all([
      overviewStats(filters),
      overviewStats({ from: prevFrom, to: from }),
      timeseriesDaily(days + 1, filters),
      byCountry(days, { from, country: null }),
      bySource(days, filters),
      hourlySentiment(30, filters),
      emergingTopics(),
      funnelStats(days, filters),
      topNegativeAspects(days, filters, 8),
      listAlerts(6),
      topMentions(filters, { sentiment: "negative", limit: 6 }),
    ]);

  return NextResponse.json({ overview, prev, series, countries, sources, hourly, emerging, funnel, aspects, alerts, evidence });
}
