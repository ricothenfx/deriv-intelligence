import { describe, expect, it } from "vitest";
import { estimateLocation, localHour, utcOffsetHours } from "./location";

describe("estimateLocation", () => {
  it("uses exact Google Play country with 0.95 confidence", () => {
    const r = estimateLocation({ source: "gplay", metadata: { country: "ng" }, language: null });
    expect(r).toEqual({ country: "NG", confidence: 0.95 });
  });

  it("falls through when gplay country is missing", () => {
    const r = estimateLocation({ source: "gplay", metadata: {}, language: null });
    expect(r).toEqual({ country: null, confidence: 0 });
  });

  it("maps local subreddits", () => {
    const r = estimateLocation({ source: "reddit", metadata: { subreddit: "r/indonesia" }, language: null });
    expect(r.country).toBe("ID");
  });

  it("maps ccTLD domains", () => {
    const r = estimateLocation({ source: "tavily", metadata: { domain: "berita.co.id" }, language: null });
    expect(r.country).toBe("ID");
  });

  it("combines subreddit + language signals", () => {
    const r = estimateLocation({ source: "reddit", metadata: { subreddit: "nigeria" }, language: "id" });
    expect(r.country).toBe("ID");
    expect(r.confidence).toBe(0.52);
  });

  it("locates English-only items with low confidence (weak language estimate)", () => {
    const r = estimateLocation({ source: "reddit", metadata: {}, language: "en" });
    expect(r.country).toBe("US");
    expect(r.confidence).toBeLessThanOrEqual(0.3);
  });

  it("returns null when no signals at all", () => {
    expect(estimateLocation({ source: "reddit", metadata: {}, language: null })).toEqual({
      country: null,
      confidence: 0,
    });
  });
});

describe("utcOffsetHours", () => {
  it("knows representative offsets", () => {
    expect(utcOffsetHours("ID")).toBe(7);
    expect(utcOffsetHours("US")).toBe(-5);
    expect(utcOffsetHours("IN")).toBe(5.5);
  });

  it("returns null for unknown countries", () => {
    expect(utcOffsetHours("XX")).toBeNull();
  });
});

describe("localHour", () => {
  const utc = (h: number) => new Date(Date.UTC(2026, 0, 1, h, 0, 0));

  it("shifts UTC into the country's local hour", () => {
    expect(localHour(utc(20), "ID")).toBe(3); // UTC+7 wraps past midnight
    expect(localHour(utc(20), "US")).toBe(15); // UTC-5
  });

  it("returns null without a country or offset", () => {
    expect(localHour(utc(20), null)).toBeNull();
    expect(localHour(utc(20), "XX")).toBeNull();
  });
});
