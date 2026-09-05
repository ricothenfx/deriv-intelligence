import { NextResponse } from "next/server";
import { costDaily } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET() {
  const costs = await costDaily(14);
  return NextResponse.json(costs);
}
