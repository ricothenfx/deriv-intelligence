import { NextRequest, NextResponse } from "next/server";
import { kolRadar } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const days = Math.min(Math.max(Number(sp.get("days") ?? 30), 1), 90);
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 30), 1), 100);
  const authors = await kolRadar(days, limit);
  return NextResponse.json({ days, authors });
}
