import { chatComplete, modelFor, type ChatCompletionTool } from "@deriv-intel/llm";
import {
  byCountry,
  bySource,
  byTopic,
  funnelStats,
  hourlySentiment,
  overviewStats,
  topNegativeAspects,
  type Filters,
} from "./analytics";
import { hybridSearch } from "./search";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallLog {
  name: string;
  args: Record<string, unknown>;
  summary: string;
}

export interface AskResult {
  answer: string;
  toolCalls: ToolCallLog[];
  model: string;
}

function def(
  name: string,
  description: string,
  properties: Record<string, { type: string; description?: string; enum?: string[] }>,
): ChatCompletionTool {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required: [] } },
  };
}

const TOOLS: ChatCompletionTool[] = [
  def(
    "overview_stats",
    "Overall stats for a period: mention count, weighted sentiment, sentiment distribution, top countries and platforms.",
    { days: { type: "number", description: "Lookback days, default 7" } },
  ),
  def(
    "sentiment_by_country",
    "Mentions and weighted sentiment per country (ISO2 code).",
    { days: { type: "number" }, country: { type: "string", description: "Filter to one country" } },
  ),
  def(
    "sentiment_by_topic",
    "Mentions and weighted sentiment per topic tag.",
    { days: { type: "number" }, country: { type: "string" } },
  ),
  def(
    "journey_funnel",
    "Customer journey funnel: signup, kyc, deposit, trading, withdrawal, support; mentions + sentiment + top negative aspects per stage.",
    { days: { type: "number" }, country: { type: "string" } },
  ),
  def(
    "hourly_pattern",
    "Mentions and sentiment by local hour of day (0-23). Useful for 'when do complaints happen'.",
    { days: { type: "number" }, country: { type: "string" } },
  ),
  def(
    "search_mentions",
    "Hybrid keyword + semantic search over collected mentions with filters. Use for evidence and quotes.",
    {
      query: { type: "string", description: "Search query" },
      days: { type: "number" },
      country: { type: "string" },
      sentiment: { type: "string", enum: ["positive", "negative", "neutral", "mixed"] },
      limit: { type: "number", description: "Default 10" },
    },
  ),
];

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ summary: string; data: unknown }> {
  const days = Math.min(Math.max(Number(args.days ?? 7) || 7, 1), 90);
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  const filters: Filters = { country: (args.country as string) || null, from };

  switch (name) {
    case "overview_stats": {
      const [overview, countries, sources] = await Promise.all([
        overviewStats(filters),
        byCountry(days, filters),
        bySource(days, filters),
      ]);
      return {
        summary: `${overview.mentions} mentions, weighted sentiment ${overview.weighted_sentiment.toFixed(2)}`,
        data: { overview, topCountries: countries.slice(0, 8), byPlatform: sources },
      };
    }
    case "sentiment_by_country": {
      const countries = await byCountry(days, filters);
      return { summary: `${countries.length} countries`, data: countries };
    }
    case "sentiment_by_topic": {
      const topics = await byTopic(days, filters, 15);
      return { summary: `${topics.length} topics`, data: topics };
    }
    case "journey_funnel": {
      const [funnel, aspects] = await Promise.all([funnelStats(days, filters), topNegativeAspects(days, filters, 10)]);
      return { summary: `weakest stage: ${[...funnel].sort((a, b) => a.sentiment - b.sentiment)[0]?.stage ?? "n/a"}`, data: { funnel, negativeAspects: aspects } };
    }
    case "hourly_pattern": {
      const hourly = await hourlySentiment(Math.min(days * 2, 30), filters);
      return { summary: `${hourly.length} hour buckets`, data: hourly };
    }
    case "search_mentions": {
      const rows = await hybridSearch(
        String(args.query ?? ""),
        { ...filters, sentiment: (args.sentiment as string) || null },
        Number(args.limit ?? 10),
      );
      return {
        summary: `${rows.length} results`,
        data: rows.map((r) => ({
          country: r.country,
          stage: r.stage,
          sentiment: r.sentiment,
          topics: r.topics,
          published: r.published_at,
          text: r.content.slice(0, 250),
          url: r.url,
        })),
      };
    }
    default:
      return { summary: "unknown tool", data: { error: `unknown tool ${name}` } };
  }
}

export async function askYourMarket(messages: ChatMessage[]): Promise<AskResult> {
  const brand = process.env.TARGET_BRAND || "Deriv";
  const system = `You are "Ask your market", the analytics copilot of a social-listening platform monitoring public perception of the brand "${brand}" (a global trading platform).
Today is ${new Date().toISOString().slice(0, 10)}. Tools return real data from the database.
Rules:
- Always call at least one tool before answering when the question involves data.
- Always answer in English.
- Be concise and concrete: cite numbers, countries, journey stages, topics. Include a short evidence quote when relevant.
- If the data is empty or missing, say that collection may still be running.
- For open questions like "what is happening right now", combine overview_stats + sentiment_by_country + journey_funnel.`;

  const convo: Record<string, unknown>[] = [{ role: "system", content: system }, ...messages];
  const toolCalls: ToolCallLog[] = [];

  for (let round = 0; round < 6; round++) {
    const msg = await chatComplete({
      tier: "strong",
      purpose: "chat",
      messages: convo as never[],
      tools: TOOLS,
      temperature: 0.3,
      maxTokens: 2500,
    });
    if (!msg.tool_calls?.length) {
      return { answer: msg.content ?? "(no answer)", toolCalls, model: modelFor("strong") };
    }
    convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
    for (const tc of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        args = {};
      }
      let out: { summary: string; data: unknown };
      try {
        out = await executeTool(tc.function.name, args);
      } catch (e) {
        out = { summary: "error", data: { error: String(e) } };
      }
      toolCalls.push({ name: tc.function.name, args, summary: out.summary });
      convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out.data).slice(0, 8000) });
    }
  }

  const final = await chatComplete({
    tier: "strong",
    purpose: "chat",
    messages: [...(convo as never[]), { role: "system", content: "Answer now using the data gathered. Do not call more tools." }],
    temperature: 0.3,
    maxTokens: 1500,
  });
  return { answer: final.content ?? "", toolCalls, model: modelFor("strong") };
}
