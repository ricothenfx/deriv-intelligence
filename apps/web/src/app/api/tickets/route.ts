import { NextRequest, NextResponse } from "next/server";
import { listTickets } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 30), 1), 100);
  const tickets = await listTickets(limit);
  return NextResponse.json({ tickets });
}
