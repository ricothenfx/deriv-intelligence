import { NextRequest, NextResponse } from "next/server";
import { escalateTicket } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { itemId?: number; draft?: string; severity?: string };
  if (!body?.itemId || !body.draft) {
    return NextResponse.json({ error: "itemId and draft are required" }, { status: 400 });
  }
  const id = await escalateTicket(Number(body.itemId), body.draft, body.severity ?? "medium");
  return NextResponse.json({ ticket_id: id });
}
