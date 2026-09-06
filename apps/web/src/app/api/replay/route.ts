import { NextRequest, NextResponse } from "next/server";
import { timelineBuckets } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const days = Math.min(Math.max(Number(sp.get("days") ?? 30), 1), 90);
  const bucketHours = Number(sp.get("bucket") ?? 6);
  const data = await timelineBuckets(days, bucketHours);
  return NextResponse.json(data);
}
