import { NextRequest, NextResponse } from "next/server";
import { funnelStats, topMentions, topNegativeAspects } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const days = Math.min(Math.max(Number(sp.get("days") ?? 7), 1), 90);
  const country = sp.get("country");
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  const filters = { country, from };

  const [funnel, aspects, evidence] = await Promise.all([
    funnelStats(days, filters),
    topNegativeAspects(days, filters, 12),
    topMentions(filters, { sentiment: "negative", limit: 10 }),
  ]);
  return NextResponse.json({ funnel, aspects, evidence });
}
