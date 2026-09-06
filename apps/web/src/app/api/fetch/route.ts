import { NextRequest, NextResponse } from "next/server";
import { getFetchQueue, SOURCE_NAMES, type FetchSource } from "@/server/fetch-queue";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const requested = body.source ?? "all";
  const sources: FetchSource[] =
    requested === "all" ? [...SOURCE_NAMES] : SOURCE_NAMES.filter((s) => s === requested);
  if (sources.length === 0) {
    return NextResponse.json(
      { error: `unknown source: ${requested} (use reddit|youtube|gplay|tavily|all)` },
      { status: 400 },
    );
  }

  try {
    const queue = getFetchQueue();
    const jobs = [];
    for (const source of sources) {
      const jobId = `manual-${source}-${Date.now()}`;
      await queue.add(source, { source }, {
        jobId,
        attempts: 2,
        backoff: { type: "exponential", delay: 15000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      });
      jobs.push({ jobId, source });
    }
    return NextResponse.json({ jobs });
  } catch (e) {
    return NextResponse.json(
      { error: `cannot reach Redis/queue: ${e instanceof Error ? e.message : String(e)}` },
      { status: 503 },
    );
  }
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId query param required" }, { status: 400 });
  try {
    const queue = getFetchQueue();
    const job = await queue.getJob(jobId);
    if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
    const state = await job.getState();
    const rv = (job.returnvalue ?? {}) as { fetched?: number; inserted?: number };
    return NextResponse.json({
      jobId,
      source: (job.data as { source?: string })?.source ?? null,
      state,
      fetched: rv.fetched ?? null,
      inserted: rv.inserted ?? null,
      error: job.failedReason ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `cannot reach Redis/queue: ${e instanceof Error ? e.message : String(e)}` },
      { status: 503 },
    );
  }
}
