"use client";

import { Card } from "@/components/ui";
import { GLOSSARY, HELP } from "@/lib/help";

export default function HelpPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Guide &amp; Glossary</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Explanations of every term and metric used in this dashboard. The (?) tooltip on each card title or number shows the same short explanations.
        </p>
      </div>

      <Card title="How this app works (big picture)">
        <ol className="list-decimal space-y-2 pl-5 text-xs leading-relaxed text-slate-300">
          <li>
            <span className="font-medium text-slate-100">Grab</span> — the worker collects raw data from 4 channels: Reddit, YouTube, Google Play, and web/news (Tavily), on an automatic schedule (Reddit every 15 minutes; YouTube &amp; Google Play hourly; web every 6 hours) or manually via the “Grab now” button on the Overview page. The keywords used per channel are editable on the Keywords page.
          </li>
          <li>
            <span className="font-medium text-slate-100">Enrich</span> — every post is analyzed by AI: sentiment, emotion, complaint aspects, topics, user journey stage, estimated country, and bot detection. {HELP.enrichment}
          </li>
          <li>
            <span className="font-medium text-slate-100">Analyze</span> — the numbers on every page are SQL aggregations over that data, always engagement-weighted and with bot posts excluded. {HELP.bot_filter}
          </li>
          <li>
            <span className="font-medium text-slate-100">Verify</span> — almost every post quote has an “open source” link that opens the original page in a new tab, so you can check it and reply directly on the source platform. Non-English posts offer a “Translate to English” button.
          </li>
        </ol>
      </Card>

      {GLOSSARY.map((section) => (
        <Card key={section.section} title={section.section}>
          <dl className="space-y-3">
            {section.entries.map((e) => (
              <div key={e.term}>
                <dt className="text-xs font-semibold text-slate-200">{e.term}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-slate-400">{e.definition}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </div>
  );
}
