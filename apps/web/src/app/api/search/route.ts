import { NextRequest, NextResponse } from "next/server";
import { hybridSearch } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const days = Math.min(Math.max(Number(sp.get("days") ?? 30), 1), 180);
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 30), 1), 100);
  const results = await hybridSearch(
    q,
    {
      country: sp.get("country"),
      source: sp.get("source"),
      sentiment: sp.get("sentiment"),
      from: new Date(Date.now() - days * 86400_000).toISOString(),
    },
    limit,
  );
  return NextResponse.json({ results });
}
