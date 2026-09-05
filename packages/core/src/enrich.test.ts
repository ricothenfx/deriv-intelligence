import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatText } from "@deriv-intel/llm";
import { classificationSchema, classifyTexts, CLASSIFICATION_BATCH } from "./enrich";

vi.mock("@deriv-intel/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@deriv-intel/llm")>();
  return { ...actual, chatText: vi.fn() };
});

const mockedChatText = vi.mocked(chatText);

const INPUTS = [
  { i: 0, source: "reddit", title: null, text: "Deriv withdrawal arrived in 2 days, smooth" },
  { i: 1, source: "gplay", title: null, text: "App keeps crashing when I open charts" },
  { i: 2, source: "reddit", title: null, text: "Unrelated post about pizza toppings" },
];

function validRow(overrides: Record<string, unknown> = {}) {
  return {
    i: 0,
    language: "en",
    mentions_brand: true,
    sentiment: "negative",
    sentiment_confidence: 0.9,
    journey_stage: "withdrawal",
    ...overrides,
  };
}

beforeEach(() => {
  mockedChatText.mockReset();
});

describe("classificationSchema", () => {
  it("accepts a valid row and applies defaults", () => {
    const r = classificationSchema.parse(validRow());
    expect(r.aspects).toEqual([]);
    expect(r.topics).toEqual([]);
    expect(r.sentiment).toBe("negative");
  });

  it("rejects sentiment outside the enum", () => {
    expect(classificationSchema.safeParse(validRow({ sentiment: "angry" })).success).toBe(false);
  });

  it("rejects confidence outside 0..1", () => {
    expect(classificationSchema.safeParse(validRow({ sentiment_confidence: 1.5 })).success).toBe(false);
  });

  it("rejects journey stages outside the taxonomy", () => {
    expect(classificationSchema.safeParse(validRow({ journey_stage: "onboarding" })).success).toBe(false);
  });
});

describe("classifyTexts", () => {
  it("places results by input index even when the LLM answers out of order", async () => {
    mockedChatText.mockResolvedValue(
      JSON.stringify({
        results: [
          validRow({ i: 1, sentiment: "negative", journey_stage: "trading" }),
          validRow({ i: 0, sentiment: "positive", journey_stage: "withdrawal" }),
        ],
      }),
    );
    const out = await classifyTexts(INPUTS);
    expect(out).toHaveLength(3);
    expect(out[0]?.sentiment).toBe("positive");
    expect(out[1]?.sentiment).toBe("negative");
    expect(out[2]).toBeUndefined();
  });

  it("parses fenced JSON responses", async () => {
    mockedChatText.mockResolvedValue(
      "```json\n" + JSON.stringify({ results: [validRow()] }) + "\n```",
    );
    const out = await classifyTexts([INPUTS[0]]);
    expect(out[0]?.sentiment).toBe("negative");
  });

  it("drops rows that fail schema validation or are out of range", async () => {
    mockedChatText.mockResolvedValue(
      JSON.stringify({
        results: [
          validRow({ i: 0, sentiment: "positive" }),
          validRow({ i: 1, sentiment: "very_positive" }),
          validRow({ i: 42, sentiment: "neutral" }),
        ],
      }),
    );
    const out = await classifyTexts(INPUTS);
    expect(out[0]?.sentiment).toBe("positive");
    expect(out[1]).toBeUndefined();
    expect(out[2]).toBeUndefined();
  });

  it("batches at the configured size", () => {
    expect(CLASSIFICATION_BATCH).toBeGreaterThan(0);
  });

  it("sends brand and item payloads to the LLM", async () => {
    mockedChatText.mockResolvedValue(JSON.stringify({ results: [validRow()] }));
    await classifyTexts([INPUTS[0]]);
    expect(mockedChatText).toHaveBeenCalledTimes(1);
    const call = mockedChatText.mock.calls[0][0];
    expect(call.tier).toBe("cheap");
    expect(call.purpose).toBe("enrich");
    expect(JSON.stringify(call.messages)).toContain("Deriv withdrawal arrived");
  });
});
