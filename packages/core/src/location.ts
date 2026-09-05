export interface LocationEstimate {
  country: string | null;
  confidence: number;
}

const SUBREDDIT_COUNTRY: Record<string, string> = {
  indonesia: "ID", indotrader: "ID", traderindonesia: "ID", traderindonesiaofficial: "ID",
  nigeria: "NG", nigeriaforex: "NG", nigerianinvestors: "NG",
  kenya: "KE", kenyanforex: "KE", kenyaforex: "KE",
  philippines: "PH", phinvest: "PH", philippinesinvestments: "PH",
  pakistan: "PK", pakistaniinvestors: "PK", pakstockexchange: "PK",
  bangladesh: "BD", bdstockmarket: "BD",
  vietnam: "VN", vietnamfinance: "VN", chungkhoan: "VN",
  thailand: "TH", th_stock: "TH", thai_investor: "TH",
  malaysia: "MY", malaysianforex: "MY", bursamalaysia: "MY",
  india: "IN", indiainvestments: "IN", indianstocks: "IN",
  southafrica: "ZA", sa_investing: "ZA",
  brazil: "BR", rendafixa: "BR", acoes: "BR",
};

const DOMAIN_SUFFIX_COUNTRY: [string, string][] = [
  [".co.id", "ID"], [".or.id", "ID"], [".id", "ID"],
  [".com.ng", "NG"], [".com.gh", "GH"], [".co.ke", "KE"], [".co.tz", "TZ"],
  [".com.ph", "PH"], [".com.br", "BR"], [".co.in", "IN"], [".co.za", "ZA"],
  [".com.vn", "VN"], [".vn", "VN"], [".co.th", "TH"], [".com.my", "MY"],
  [".com.pk", "PK"], [".com.bd", "BD"], [".com.eg", "EG"], [".com.ng", "NG"],
];

const LANGUAGE_COUNTRY: Record<string, [string, number][]> = {
  id: [["ID", 0.75]],
  ms: [["MY", 0.6], ["BN", 0.15]],
  fil: [["PH", 0.65]], tl: [["PH", 0.65]],
  vi: [["VN", 0.8]], th: [["TH", 0.8]], bn: [["BD", 0.75]], ur: [["PK", 0.7]],
  sw: [["KE", 0.55], ["TZ", 0.2]], hi: [["IN", 0.5]], ta: [["IN", 0.45], ["LK", 0.2]],
  ru: [["RU", 0.6]], pt: [["BR", 0.55], ["PT", 0.2]], ar: [["EG", 0.25], ["SA", 0.2], ["AE", 0.15]],
  en: [["US", 0.2], ["GB", 0.15], ["NG", 0.15], ["PH", 0.08], ["IN", 0.08], ["ZA", 0.06], ["KE", 0.05], ["MY", 0.04]],
};

const UTC_OFFSETS: Record<string, number> = {
  US: -5, CA: -5, MX: -6, BR: -3, AR: -3, CL: -4, CO: -5, PE: -5,
  GB: 0, IE: 0, PT: 0, ES: 1, FR: 1, DE: 1, IT: 1, NL: 1, PL: 1, CZ: 1, SE: 1, NO: 1,
  NG: 1, GH: 0, MA: 1, EG: 2, ZA: 2, KE: 3, TZ: 3, SA: 3, AE: 4, KW: 3, QA: 3, JO: 3, TR: 3,
  IN: 5.5, PK: 5, BD: 6, NP: 5.75, LK: 5.5,
  ID: 7, TH: 7, VN: 7, MY: 8, SG: 8, PH: 8, CN: 8, TW: 8, HK: 8, AU: 10, NZ: 12,
  RU: 3, UA: 3, JP: 9, KR: 9,
};

export function utcOffsetHours(country: string): number | null {
  const off = UTC_OFFSETS[country.toUpperCase()];
  return off == null ? null : off;
}

export function estimateLocation(meta: {
  source: string;
  metadata: Record<string, unknown>;
  language: string | null;
}): LocationEstimate {
  const scores: Record<string, number> = {};
  const add = (c: string, w: number) => {
    scores[c] = (scores[c] ?? 0) + w;
  };

  if (meta.source === "gplay") {
    const c = String(meta.metadata.country ?? "").toUpperCase();
    if (c) return { country: c, confidence: 0.95 };
  }

  const sub = String(meta.metadata.subreddit ?? "").toLowerCase().replace(/^r\//, "");
  if (sub && SUBREDDIT_COUNTRY[sub]) add(SUBREDDIT_COUNTRY[sub], 0.7);

  const domain = String(meta.metadata.domain ?? "").toLowerCase();
  if (domain) {
    for (const [suffix, c] of DOMAIN_SUFFIX_COUNTRY) {
      if (domain.endsWith(suffix)) {
        add(c, 0.6);
        break;
      }
    }
  }

  const lang = (meta.language || "").toLowerCase();
  if (lang && LANGUAGE_COUNTRY[lang]) {
    for (const [c, w] of LANGUAGE_COUNTRY[lang]) add(c, w);
  }

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!entries.length || entries[0][1] < 0.25) return { country: null, confidence: 0 };
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return { country: entries[0][0], confidence: Math.min(0.9, Number((entries[0][1] / total).toFixed(2))) };
}

export function localHour(publishedAt: Date, country: string | null): number | null {
  if (!country) return null;
  const off = utcOffsetHours(country);
  if (off == null) return null;
  return new Date(publishedAt.getTime() + Math.round(off) * 3600_000).getUTCHours();
}
