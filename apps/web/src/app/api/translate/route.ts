import { NextRequest, NextResponse } from "next/server";
import { translateItem } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { item_id?: number };
  const itemId = Number(body?.item_id);
  if (!itemId || Number.isNaN(itemId)) {
    return NextResponse.json({ error: "item_id is required" }, { status: 400 });
  }
  try {
    const result = await translateItem(itemId);
    if (!result) return NextResponse.json({ error: "item not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
