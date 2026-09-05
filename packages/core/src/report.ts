import PDFDocument from "./pdf";
import { createWriteStream, mkdirSync } from "fs";
import { join, resolve } from "path";
import { chatText, parseJson } from "@deriv-intel/llm";
import { query } from "./db";
import {
  byCountry,
  bySource,
  byTopic,
  emergingTopics,
  funnelStats,
  overviewStats,
  timeseriesDaily,
  topMentions,
  topNegativeAspects,
} from "./analytics";
import { sendTelegram } from "./notify";

export interface WeeklyReportResult {
  id: number;
  filePath: string;
  summary: string;
}

export async function generateWeeklyReport(opts: { notify?: boolean } = {}): Promise<WeeklyReportResult> {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 86400_000);
  const from = start.toISOString();
  const prevFrom = new Date(start.getTime() - 7 * 86400_000).toISOString();

  const [overview, prev, countries, sources, topics, emerging, funnel, aspects, evidence, alertsRows] =
    await Promise.all([
      overviewStats({ from }),
      overviewStats({ from: prevFrom, to: from }),
      byCountry(7, { from }),
      bySource(7, { from }),
      byTopic(7, { from }, 10),
      emergingTopics(),
      funnelStats(7, { from }),
      topNegativeAspects(7, { from }, 8),
      topMentions({ from }, { sentiment: "negative", limit: 8 }),
      query<Record<string, string>>(
        `select id, metric, scope, severity, to_char(created_at, 'YYYY-MM-DD HH24:MI') as created_at, explanation
         from alerts where created_at >= $1 order by created_at desc limit 10`,
        [from],
      ),
    ]);

  let summary = "";
  let recommendations: string[] = [];
  try {
    const raw = await chatText({
      tier: "strong",
      purpose: "report",
      messages: [
        {
          role: "system",
          content:
            'You are the head of customer intelligence at a global trading platform. Given weekly social-listening data, produce: (1) an executive summary of 4-6 sentences, (2) 3-5 actionable recommendations ordered by expected impact. CRITICAL LANGUAGE RULE: write strictly in English. Input posts may be in Indonesian, Portuguese, or other languages — never mirror them; every word of the output must be in English only. Return strict JSON {"summary":"...","recommendations":["..."]}',
        },
        {
          role: "user",
          content: JSON.stringify({
            overview,
            previous_week: prev,
            top_countries: countries.slice(0, 8),
            platforms: sources,
            topics,
            emerging_topics: emerging,
            journey_funnel: funnel,
            negative_aspects: aspects,
            sample_negative_posts: evidence.map((e) => ({
              country: e.country,
              stage: e.stage,
              text: e.content.slice(0, 200),
            })),
          }).slice(0, 12000),
        },
      ],
      json: true,
      temperature: 0.2,
      maxTokens: 2000,
    });
    const parsed = parseJson<{ summary?: string; recommendations?: string[] }>(raw);
    summary = parsed.summary ?? "";
    recommendations = parsed.recommendations ?? [];
  } catch (e) {
    console.error("report LLM failed:", e);
  }
  if (!summary) {
    summary = `This week ${overview.mentions} mentions were collected with weighted sentiment ${overview.weighted_sentiment.toFixed(2)} (previous week ${prev.weighted_sentiment.toFixed(2)}).`;
  }

  const dir = process.env.REPORT_DIR || resolve(process.cwd(), "../../artifacts/reports");
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `weekly-${end.toISOString().slice(0, 10)}.pdf`);
  await writePdf(filePath, {
    period: `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`,
    overview,
    prev,
    countries,
    sources,
    topics,
    emerging,
    funnel,
    aspects,
    evidence,
    alerts: alertsRows,
    summary,
    recommendations,
  });

  const inserted = await query<{ id: number }>(
    `insert into reports (period_start, period_end, summary, sections, file_path)
     values ($1, $2, $3, $4::jsonb, $5) returning id`,
    [
      start,
      end,
      summary,
      JSON.stringify({ overview, countries: countries.slice(0, 8), funnel, aspects, recommendations }),
      filePath,
    ],
  );
  const id = Number(inserted[0].id);

  if (opts.notify !== false) {
    const topIssues = aspects.slice(0, 3).map((a) => `${a.aspect} (${a.negative})`).join(", ");
    const ok = await sendTelegram(
      `Deriv Intelligence — Weekly Report ${end.toISOString().slice(0, 10)}\n\n${summary}\n\nTop issues: ${topIssues || "-"}`,
    );
    if (ok) await query(`update reports set sent = true where id = $1`, [id]);
  }

  return { id, filePath, summary };
}

interface PdfData {
  period: string;
  overview: Awaited<ReturnType<typeof overviewStats>>;
  prev: Awaited<ReturnType<typeof overviewStats>>;
  countries: Awaited<ReturnType<typeof byCountry>>;
  sources: Awaited<ReturnType<typeof bySource>>;
  topics: Awaited<ReturnType<typeof byTopic>>;
  emerging: Awaited<ReturnType<typeof emergingTopics>>;
  funnel: Awaited<ReturnType<typeof funnelStats>>;
  aspects: Awaited<ReturnType<typeof topNegativeAspects>>;
  evidence: Awaited<ReturnType<typeof topMentions>>;
  alerts: Record<string, string>[];
  summary: string;
  recommendations: string[];
}

function writePdf(filePath: string, d: PdfData): Promise<void> {
  return new Promise((res, rej) => {
    const doc = new PDFDocument({ margin: 44, size: "A4" });
    const stream = createWriteStream(filePath);
    doc.pipe(stream);
    stream.on("finish", () => res());
    stream.on("error", rej);

    const h1 = (t: string) => {
      doc.moveDown(0.6).fontSize(15).fillColor("#111").text(t).moveDown(0.2);
      doc.moveTo(44, doc.y).lineTo(551, doc.y).strokeColor("#ccc").stroke();
      doc.moveDown(0.3).fontSize(9.5);
    };
    const line = (t: string, indent = 0) => doc.fontSize(9.5).fillColor("#222").text(t, 44 + indent, undefined, { width: 507 });

    doc.fontSize(21).fillColor("#111").text("Deriv Intelligence");
    doc.fontSize(10).fillColor("#666").text(`Weekly Market Perception Report — ${d.period}`);
    doc.fontSize(8.5).fillColor("#999").text(`Generated ${new Date().toISOString()}`);

    h1("Executive Summary");
    line(d.summary);

    h1("Key Metrics");
    line(`Mentions: ${d.overview.mentions} (last week ${d.prev.mentions})`);
    line(`Engagement-weighted sentiment: ${d.overview.weighted_sentiment.toFixed(3)} (last week ${d.prev.weighted_sentiment.toFixed(3)})`);
    line(`Distribution: positive ${d.overview.positive} / neutral ${d.overview.neutral} / mixed ${d.overview.mixed} / negative ${d.overview.negative}`);
    line(`Mentions with estimated location: ${d.overview.located} of ${d.overview.mentions}`);

    h1("By Country (Top 10)");
    d.countries.slice(0, 10).forEach((c) => {
      line(`${c.key}  —  ${c.mentions} mentions, sentiment ${c.sentiment.toFixed(3)} (neg: ${c.negative}, pos: ${c.positive})`, 6);
    });

    h1("Journey Funnel");
    d.funnel.forEach((f) => {
      line(`${f.stage.padEnd(11)} ${String(f.mentions).padStart(4)} mentions  sentiment ${f.sentiment.toFixed(3)}  negative ${f.negative}`, 6);
    });

    h1("Top Negative Aspects");
    d.aspects.forEach((a) => {
      line(`${a.aspect} (${a.stage ?? "-"}) — ${a.negative} complaints`, 6);
    });

    h1("Topics & Emerging");
    d.topics.slice(0, 8).forEach((t) => line(`${t.key} — ${t.mentions} mentions, sentiment ${t.sentiment.toFixed(3)}`, 6));
    if (d.emerging.length) {
      doc.moveDown(0.3);
      line("Topics rising vs last week:");
      d.emerging.slice(0, 5).forEach((t) => {
        const delta = t.delta == null ? "new" : `${(t.delta * 100).toFixed(0)}%`;
        line(`${t.topic} — ${t.current} mentions (+${delta} from ${t.previous})`, 12);
      });
    }

    if (d.alerts.length) {
      h1("Alerts This Week");
      d.alerts.forEach((a) => line(`[${a.severity}] ${a.scope} — ${a.created_at}`, 6));
    }

    h1("Evidence (Representative Negative Posts)");
    d.evidence.slice(0, 6).forEach((e) => {
      line(`[${e.country ?? "?"} / ${e.stage ?? "-"}] ${e.content.slice(0, 220).replace(/\s+/g, " ")}`, 6);
      if (e.url) doc.fontSize(8).fillColor("#3b82f6").text(e.url, 50, undefined, { width: 500, link: e.url });
      doc.moveDown(0.2);
    });

    h1("Recommendations");
    d.recommendations.forEach((r, i) => line(`${i + 1}. ${r}`, 6));

    doc.moveDown(1);
    doc.fontSize(8).fillColor("#999").text("Generated by Deriv Intelligence — internal analytics platform.");
    doc.end();
  });
}
