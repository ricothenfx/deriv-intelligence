import { NextRequest, NextResponse } from "next/server";
import { benchmarkByBrand, brandAspects, switchers } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const days = Math.min(Math.max(Number(sp.get("days") ?? 30), 1), 90);
  const country = sp.get("country");
  const from = new Date(Date.now() - days * 86400_000).toISOString();

  const [brands, aspects, switching] = await Promise.all([
    benchmarkByBrand({ from, country }),
    brandAspects({ from, country }, 6),
    switchers({ from: new Date(Date.now() - 90 * 86400_000).toISOString() }, 10),
  ]);
  return NextResponse.json({ days, brands, aspects, switchers: switching });
}
