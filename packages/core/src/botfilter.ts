const SPAM_PATTERNS = [
  /(?:dm|inbox|contact)\s+(?:me|him|her)\b/i,
  /recover (?:your |my )?(?:funds|money|scam)/i,
  /guaranteed (?:profit|return)/i,
  /make \$?\d[\d,.]*\s*(?:a|per)\s*(?:day|week|month)/i,
  /whats?app\s*\+?\d{7,}/i,
  /(?:telegram|wa|line)\s*[:@]?\s*\+?\d{7,}/i,
  /investment (?:opportunity|plan)/i,
  /free (?:binary options? )?(?:signals|robot)/i,
];

export interface BotCheck {
  bot: boolean;
  reason: string | null;
}

export function botCheck(item: { content: string }): BotCheck {
  const text = item.content || "";
  if (text.trim().length < 10) return { bot: true, reason: "too_short" };
  const links = text.match(/https?:\/\/\S+/g) ?? [];
  if (links.length > 2) return { bot: true, reason: "link_spam" };
  if (/(.)\1{9,}/.test(text)) return { bot: true, reason: "char_repeat" };
  for (const p of SPAM_PATTERNS) if (p.test(text)) return { bot: true, reason: "spam_template" };
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 40) {
    const caps = text.replace(/[^A-Z]/g, "").length;
    if (caps / letters.length > 0.85) return { bot: true, reason: "all_caps" };
  }
  return { bot: false, reason: null };
}
