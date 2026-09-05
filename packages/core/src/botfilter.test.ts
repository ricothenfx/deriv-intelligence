import { describe, expect, it } from "vitest";
import { botCheck } from "./botfilter";

describe("botCheck", () => {
  it("flags very short content", () => {
    expect(botCheck({ content: "ok" })).toEqual({ bot: true, reason: "too_short" });
  });

  it("flags link spam (more than 2 links)", () => {
    const text = "check this out http://a.com and http://b.com and also http://c.com today";
    expect(botCheck({ content: text })).toEqual({ bot: true, reason: "link_spam" });
  });

  it("flags long character repetition", () => {
    expect(botCheck({ content: "w".repeat(15) + " withdrawal delay" })).toEqual({
      bot: true,
      reason: "char_repeat",
    });
  });

  it("flags DM/recovery spam templates", () => {
    expect(botCheck({ content: "DM me now, I can recover your funds from any scam broker" }).reason).toBe(
      "spam_template",
    );
    expect(botCheck({ content: "Join my investment opportunity with guaranteed profit every week" }).reason).toBe(
      "spam_template",
    );
    expect(botCheck({ content: "Free binary options signals, whatsapp +12345678901" }).reason).toBe(
      "spam_template",
    );
  });

  it("allows up to 2 links", () => {
    expect(botCheck({ content: "Deriv review here http://a.com and http://b.com worth reading" }).bot).toBe(false);
  });

  it("flags shouty all-caps posts (40+ letters)", () => {
    const text = "THIS BROKER IS A TOTAL SCAM AND THEY STOLE ALL OF MY MONEY TODAY";
    expect(botCheck({ content: text })).toEqual({ bot: true, reason: "all_caps" });
  });

  it("passes genuine mixed-case complaints", () => {
    expect(
      botCheck({ content: "Withdrawal took 3 days but support solved it, overall an okay app." }).bot,
    ).toBe(false);
    expect(botCheck({ content: "wd lama banget, sudah 5 hari belum masuk ke rekening" }).bot).toBe(false);
  });
});
