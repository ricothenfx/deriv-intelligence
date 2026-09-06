import { NextRequest, NextResponse } from "next/server";
import { draftReply } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { itemId?: number; tone?: string };
  if (!body?.itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }
  try {
    const draft = await draftReply(Number(body.itemId), body.tone);
    return NextResponse.json(draft);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
