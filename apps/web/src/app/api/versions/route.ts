import { NextRequest, NextResponse } from "next/server";
import { gplayByVersion } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const days = Math.min(Math.max(Number(sp.get("days") ?? 90), 1), 365);
  const versions = await gplayByVersion(days, 24);
  return NextResponse.json({ days, versions });
}
