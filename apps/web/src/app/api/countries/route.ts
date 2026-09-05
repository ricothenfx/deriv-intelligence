import { NextRequest, NextResponse } from "next/server";
import { byCountry, byTopic, hourlySentiment, overviewStats, timeseriesDaily, topMentions } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const days = Math.min(Math.max(Number(sp.get("days") ?? 30), 1), 90);
  const country = sp.get("country");
  const from = new Date(Date.now() - days * 86400_000).toISOString();

  if (!country) {
    const [countries, overview] = await Promise.all([
      byCountry(days, { from, country: null }),
      overviewStats({ from }),
    ]);
    return NextResponse.json({ countries, overview });
  }

  const [overview, series, topics, hourly, mentions] = await Promise.all([
    overviewStats({ country, from }),
    timeseriesDaily(days, { country, from }),
    byTopic(days, { country, from }, 10),
    hourlySentiment(30, { country, from }),
    topMentions({ country, from }, { limit: 12 }),
  ]);
  return NextResponse.json({ country, overview, series, topics, hourly, mentions });
}
