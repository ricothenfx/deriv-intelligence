import { chatText, parseJson } from "@deriv-intel/llm";
import { query, withTx } from "./db";

export interface CopilotDraft {
  item_id: number;
  draft: string;
  tone: string;
  language: string;
  escalate: boolean;
  severity: "low" | "medium" | "high" | "urgent";
  rationale: string;
}

interface ItemDetail {
  id: number;
  source: string;
  url: string | null;
  title: string | null;
  content: string;
  author: string | null;
  language: string | null;
  sentiment: string | null;
  aspects: { name: string; sentiment: string }[];
  topics: string[];
  journey_stage: string | null;
  country: string | null;
  published_at: string;
}

async function loadItem(itemId: number): Promise<ItemDetail | null> {
  const rows = await query<Record<string, string>>(
    `select i.id, i.source, i.url, i.title, i.content, i.author,
       e.language, e.sentiment, e.aspects, e.topics, e.journey_stage, e.location_country,
       to_char(i.published_at, 'YYYY-MM-DD HH24:MI') as published_at
     from items i left join item_enrichments e on e.item_id = i.id
     where i.id = $1`,
    [itemId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    source: r.source,
    url: r.url ?? null,
    title: r.title ?? null,
    content: r.content,
    author: r.author ?? null,
    language: r.language ?? null,
    sentiment: r.sentiment ?? null,
    aspects: (r.aspects as unknown as { name: string; sentiment: string }[]) ?? [],
    topics: (r.topics as unknown as string[]) ?? [],
    journey_stage: r.journey_stage ?? null,
    country: r.location_country ?? null,
    published_at: r.published_at,
  };
}

const TONE_BY_SOURCE: Record<string, string> = {
  gplay: "warm, professional support reply to an app review; acknowledge the rating, no marketing fluff",
  reddit: "helpful community-manager reply, casual but competent, no corporate boilerplate",
  youtube: "short friendly comment reply",
  tavily: "formal public statement draft for a news/blog article context",
};

export async function draftReply(itemId: number, toneOverride?: string): Promise<CopilotDraft> {
  const item = await loadItem(itemId);
  if (!item) throw new Error(`item ${itemId} not found`);

  const tone = toneOverride || TONE_BY_SOURCE[item.source] || "professional support reply";
  const raw = await chatText({
    tier: "strong",
    purpose: "copilot",
    messages: [
      {
        role: "system",
        content:
          'You are a response copilot for the trading platform "Deriv". Draft a public reply to the user post below. Rules: reply in the SAME language as the post (Indonesian post -> Indonesian reply, etc.). Follow the requested tone. Never promise specific timelines or refunds; direct to support channels when account-specific. Also decide if this needs escalation to a human ticket. Return strict JSON {"draft":"...","tone":"...","language":"<iso>","escalate":true/false,"severity":"low|medium|high|urgent","rationale":"one sentence"}',
      },
      {
        role: "user",
        content: JSON.stringify({
          platform: item.source,
          tone,
          post: {
            author: item.author,
            country: item.country,
            sentiment: item.sentiment,
            aspects: item.aspects,
            stage: item.journey_stage,
            topics: item.topics,
            text: item.content.slice(0, 1500),
          },
        }),
      },
    ],
    json: true,
    temperature: 0.3,
    maxTokens: 700,
  });

  let out: CopilotDraft;
  try {
    const p = parseJson<Partial<CopilotDraft>>(raw);
    const sev = ["low", "medium", "high", "urgent"].includes(String(p.severity)) ? (p.severity as CopilotDraft["severity"]) : "medium";
    out = {
      item_id: itemId,
      draft: p.draft ?? "",
      tone: p.tone ?? tone,
      language: p.language ?? item.language ?? "en",
      escalate: p.escalate ?? (sev === "high" || sev === "urgent"),
      severity: sev,
      rationale: p.rationale ?? "",
    };
  } catch {
    out = {
      item_id: itemId,
      draft: raw.slice(0, 1200),
      tone,
      language: item.language ?? "en",
      escalate: item.sentiment === "negative",
      severity: "medium",
      rationale: "fallback (LLM output was not valid JSON)",
    };
  }
  return out;
}

export interface TicketRow {
  id: number;
  item_id: number;
  draft: string | null;
  severity: string;
  status: string;
  created_at: string;
  content_preview: string | null;
  country: string | null;
}

export async function escalateTicket(itemId: number, draft: string, severity: string): Promise<number> {
  const allowed = ["low", "medium", "high", "urgent"];
  const sev = allowed.includes(severity) ? severity : "medium";
  const rows = await withTx(async (c) =>
    (
      await c.query<{ id: string }>(
        `insert into tickets (item_id, draft, severity) values ($1, $2, $3) returning id`,
        [itemId, draft.slice(0, 4000), sev],
      )
    ).rows,
  );
  return Number(rows[0]?.id ?? 0);
}

export async function listTickets(limit = 30): Promise<TicketRow[]> {
  const rows = await query<Record<string, string>>(
    `select t.id, t.item_id, t.draft, t.severity, t.status,
       to_char(t.created_at, 'YYYY-MM-DD HH24:MI') as created_at,
       left(i.content, 160) as content_preview, e.location_country
     from tickets t
     join items i on i.id = t.item_id
     left join item_enrichments e on e.item_id = t.item_id
     order by t.created_at desc limit ${Math.min(Math.max(limit, 1), 100)}`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    item_id: Number(r.item_id),
    draft: r.draft ?? null,
    severity: r.severity,
    status: r.status,
    created_at: r.created_at,
    content_preview: r.content_preview ?? null,
    country: r.location_country ?? null,
  }));
}
