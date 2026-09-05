import OpenAI from "openai";
import type {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

export type Tier = "cheap" | "strong";

export interface UsageRecord {
  purpose: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  source?: string | null;
}

export type UsageSink = (u: UsageRecord) => void | Promise<void>;

let sink: UsageSink | null = null;

export function setUsageSink(s: UsageSink): void {
  sink = s;
}

let cached: OpenAI | null = null;

function client(): OpenAI {
  if (!cached) {
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) throw new Error("LLM_API_KEY is not set");
    cached = new OpenAI({
      apiKey,
      baseURL: process.env.LLM_BASE_URL || undefined,
      maxRetries: 3,
      timeout: 120000,
    });
  }
  return cached;
}

export function modelFor(tier: Tier): string {
  const v = tier === "cheap" ? process.env.LLM_MODEL_CHEAP : process.env.LLM_MODEL_STRONG;
  return (v || (tier === "cheap" ? "gpt-4o-mini" : "gpt-4o")).trim();
}

export function embeddingModel(): string {
  return (process.env.LLM_EMBEDDING_MODEL || "text-embedding-3-small").trim();
}

export function embeddingDim(): number {
  return Number(process.env.EMBEDDING_DIM || 1536);
}

function parsePrices(): Record<string, { input: number; output: number }> {
  const raw = process.env.LLM_PRICES || "";
  const out: Record<string, { input: number; output: number }> = {};
  for (const part of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [model, input, output] = part.split(":").map((s) => s.trim());
    if (model && input && output) out[model] = { input: Number(input), output: Number(output) };
  }
  return out;
}

function record(
  purpose: string,
  source: string | null | undefined,
  model: string,
  usage: { prompt_tokens: number; completion_tokens: number } | undefined,
): void {
  if (!sink || !usage) return;
  const price = parsePrices()[model];
  const costUsd = price
    ? (usage.prompt_tokens / 1e6) * price.input + (usage.completion_tokens / 1e6) * price.output
    : null;
  void Promise.resolve(
    sink({
      purpose,
      model,
      source: source ?? null,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      costUsd,
    }),
  ).catch(() => {});
}

export interface ChatOptions {
  tier: Tier;
  purpose: string;
  source?: string;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  tools?: ChatCompletionTool[];
}

export async function chatComplete(opts: ChatOptions): Promise<ChatCompletionMessage> {
  const model = modelFor(opts.tier);
  const res = await client().chat.completions.create({
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.maxTokens ?? 2000,
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
    ...(opts.tools ? { tools: opts.tools, tool_choice: "auto" as const } : {}),
  });
  record(opts.purpose, opts.source, model, res.usage);
  return res.choices[0]?.message ?? { role: "assistant", content: "" };
}

export async function chatText(opts: ChatOptions): Promise<string> {
  const msg = await chatComplete(opts);
  return msg.content ?? "";
}

export async function embed(texts: string[], purpose = "embedding", source?: string): Promise<number[][]> {
  const model = embeddingModel();
  const res = await client().embeddings.create({ model, input: texts });
  record(purpose, source, model, (res as unknown as { usage?: { prompt_tokens: number; completion_tokens: number } }).usage);
  return [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export function parseJson<T>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const starts = [t.indexOf("{"), t.indexOf("[")].filter((i) => i >= 0);
  const start = starts.length ? Math.min(...starts) : -1;
  const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t) as T;
}
