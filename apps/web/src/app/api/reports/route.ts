import { NextResponse } from "next/server";
import { generateWeeklyReport, query } from "@deriv-intel/core";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const reports = await query(
    `select id, to_char(period_start, 'YYYY-MM-DD') as period_start,
       to_char(period_end, 'YYYY-MM-DD') as period_end, summary, file_path, sent,
       to_char(created_at, 'YYYY-MM-DD HH24:MI') as created_at
     from reports order by created_at desc limit 20`,
  );
  return NextResponse.json({ reports });
}

export async function POST() {
  try {
    const report = await generateWeeklyReport({ notify: false });
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
