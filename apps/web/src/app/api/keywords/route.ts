import { NextRequest, NextResponse } from "next/server";
import { keywordConfig, resetKeywords, setKeywords } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET() {
  const sources = await keywordConfig();
  return NextResponse.json({ sources });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as { source?: string; queries?: unknown };
  const source = String(body?.source ?? "");
  if (!source) return NextResponse.json({ error: "source is required" }, { status: 400 });
  if (!Array.isArray(body?.queries) || body.queries.some((q) => typeof q !== "string")) {
    return NextResponse.json({ error: "queries must be an array of strings" }, { status: 400 });
  }
  try {
    await setKeywords(source, body.queries as string[]);
    return NextResponse.json({ sources: await keywordConfig() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source");
  if (!source) return NextResponse.json({ error: "source is required" }, { status: 400 });
  try {
    await resetKeywords(source);
    return NextResponse.json({ sources: await keywordConfig() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
