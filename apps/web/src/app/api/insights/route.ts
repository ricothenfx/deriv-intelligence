import { NextRequest, NextResponse } from "next/server";
import { correlations } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const days = Math.min(Math.max(Number(sp.get("days") ?? 30), 1), 90);
  const data = await correlations(days);
  return NextResponse.json({ days, ...data });
}
