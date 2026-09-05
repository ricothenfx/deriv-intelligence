import { NextRequest, NextResponse } from "next/server";
import { byTopic, emergingTopics, timeseriesDaily, topMentions } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const days = Math.min(Math.max(Number(sp.get("days") ?? 7), 1), 90);
  const country = sp.get("country");
  const topic = sp.get("topic");
  const from = new Date(Date.now() - days * 86400_000).toISOString();

  const [topics, emerging] = await Promise.all([
    byTopic(days, { from, country }, 25),
    emergingTopics({ country }),
  ]);

  if (!topic) {
    return NextResponse.json({ topics, emerging });
  }

  const [series, mentions] = await Promise.all([
    timeseriesDaily(days, { topic, country, from }),
    topMentions({ topic, country, from }, { limit: 12 }),
  ]);
  return NextResponse.json({ topics, emerging, topic, series, mentions });
}
