import { describe, expect, it } from "vitest";
import type { NormalizedItem } from "@deriv-intel/connectors";
import { cleanText, contentHash, engagementScore } from "./normalize";

function item(partial: Partial<NormalizedItem>): NormalizedItem {
  return {
    source: "reddit",
    sourceId: "t1_x",
    url: null,
    title: null,
    content: "text",
    author: null,
    language: null,
    publishedAt: new Date(),
    engagement: {},
    metadata: {},
    ...partial,
  };
}

describe("cleanText", () => {
  it("collapses repeated spaces and tabs, then trims", () => {
    expect(cleanText("  hello   world \t! ")).toBe("hello world !");
  });

  it("strips CR and control characters but keeps newlines", () => {
    expect(cleanText("a\r\n\u0007b")).toBe("a\nb");
  });

  it("collapses 3+ newlines into a blank line", () => {
    expect(cleanText("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("caps content at 6000 characters", () => {
    expect(cleanText("x".repeat(7000)).length).toBe(6000);
  });
});

describe("contentHash", () => {
  it("is case- and punctuation-insensitive for the same source", () => {
    expect(contentHash("reddit", "Withdrawal DELAY!!!")).toBe(contentHash("reddit", "withdrawal delay"));
  });

  it("differs between sources for identical content", () => {
    expect(contentHash("reddit", "same text")).not.toBe(contentHash("youtube", "same text"));
  });

  it("changes when content changes", () => {
    expect(contentHash("reddit", "withdrawal delay")).not.toBe(contentHash("reddit", "deposit delay"));
  });
});

describe("engagementScore", () => {
  it("reddit: score + 2 x comments", () => {
    expect(engagementScore(item({ engagement: { score: 10, comments: 5 } }))).toBe(20);
  });

  it("youtube video: logarithmic in views", () => {
    const s = engagementScore(
      item({ source: "youtube", engagement: { viewCount: 9999 }, metadata: { kind: "video" } }),
    );
    expect(s).toBeCloseTo(Math.log10(10000) * 10, 5);
  });

  it("youtube comment: likes x 3 + 1", () => {
    expect(
      engagementScore(item({ source: "youtube", engagement: { likes: 4 }, metadata: { kind: "comment" } })),
    ).toBe(13);
  });

  it("gplay: 1 + thumbs up", () => {
    expect(engagementScore(item({ source: "gplay", engagement: { thumbsUp: 9 } }))).toBe(10);
  });

  it("unknown source: constant 1", () => {
    expect(engagementScore(item({ source: "tavily" }))).toBe(1);
  });
});
