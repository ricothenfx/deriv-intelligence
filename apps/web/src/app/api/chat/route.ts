import { NextRequest, NextResponse } from "next/server";
import { setUsageSink } from "@deriv-intel/llm";
import { askYourMarket, withTx, type ChatMessage } from "@deriv-intel/core";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

setUsageSink((u) =>
  withTx(async (c) => {
    await c.query(
      `insert into llm_usage (purpose, model, source, input_tokens, output_tokens, cost_usd)
       values ($1, $2, $3, $4, $5, $6)`,
      [u.purpose, u.model, u.source, u.inputTokens, u.outputTokens, u.costUsd],
    );
  }).catch(() => {}),
);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { messages?: ChatMessage[] };
    const messages = (body.messages ?? [])
      .filter(
        (m): m is ChatMessage =>
          (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0,
      )
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (!messages.length || messages[messages.length - 1]!.role !== "user") {
      return NextResponse.json({ error: "last message must be from the user" }, { status: 400 });
    }
    const result = await askYourMarket(messages);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
