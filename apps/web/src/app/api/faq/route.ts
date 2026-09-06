import { NextRequest, NextResponse } from "next/server";
import { generateFaqs, listFaqs } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET() {
  const faqs = await listFaqs(40);
  return NextResponse.json({ faqs });
}

export async function POST(req: NextRequest) {
  let max = 12;
  try {
    const body = (await req.json()) as { max?: number };
    if (body?.max) max = Math.min(Math.max(Number(body.max), 1), 20);
  } catch {
    // no body
  }
  const out = await generateFaqs(max);
  const faqs = await listFaqs(40);
  return NextResponse.json({ created: out.created, faqs });
}
