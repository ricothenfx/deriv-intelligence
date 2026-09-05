import { NextResponse } from "next/server";
import { listAlerts } from "@deriv-intel/core";

export const dynamic = "force-dynamic";

export async function GET() {
  const alerts = await listAlerts(100);
  return NextResponse.json({ alerts });
}
