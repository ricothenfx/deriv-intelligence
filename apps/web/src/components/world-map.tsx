"use client";

import { ComposableMap, Geographies, Geography } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const NUM_TO_ISO2: Record<string, string> = {
  "012": "DZ", "024": "AO", "032": "AR", "036": "AU", "040": "AT", "044": "BS", "050": "BD",
  "051": "AM", "056": "BE", "068": "BO", "070": "BA", "072": "BW", "076": "BR", "096": "BN",
  "100": "BG", "104": "MM", "108": "BI", "112": "BY", "116": "KH", "120": "CM", "124": "CA",
  "140": "CF", "144": "LK", "148": "TD", "152": "CL", "156": "CN", "158": "TW", "170": "CO",
  "174": "KM", "178": "CG", "180": "CD", "188": "CR", "191": "HR", "192": "CU", "196": "CY",
  "203": "CZ", "208": "DK", "214": "DO", "218": "EC", "222": "SV", "226": "GQ", "231": "ET",
  "233": "EE", "242": "FJ", "246": "FI", "250": "FR", "262": "DJ", "266": "GA", "268": "GE",
  "270": "GM", "276": "DE", "288": "GH", "300": "GR", "320": "GT", "324": "GN", "328": "GY",
  "332": "HT", "340": "HN", "348": "HU", "352": "IS", "356": "IN", "360": "ID", "364": "IR",
  "368": "IQ", "372": "IE", "376": "IL", "380": "IT", "384": "CI", "388": "JM", "392": "JP",
  "398": "KZ", "400": "JO", "404": "KE", "408": "KP", "410": "KR", "414": "KW", "417": "KG",
  "418": "LA", "422": "LB", "426": "LS", "428": "LV", "430": "LR", "434": "LY", "440": "LT",
  "442": "LU", "450": "MG", "454": "MW", "458": "MY", "466": "ML", "478": "MR", "484": "MX",
  "496": "MN", "498": "MD", "499": "ME", "504": "MA", "508": "MZ", "512": "OM", "516": "NA",
  "524": "NP", "528": "NL", "540": "NC", "548": "VU", "554": "NZ", "558": "NI", "562": "NE",
  "566": "NG", "578": "NO", "586": "PK", "591": "PA", "598": "PG", "600": "PY", "604": "PE",
  "608": "PH", "616": "PL", "620": "PT", "624": "GW", "626": "TL", "630": "PR", "634": "QA",
  "642": "RO", "643": "RU", "646": "RW", "682": "SA", "686": "SN", "688": "RS", "694": "SL",
  "703": "SK", "704": "VN", "705": "SI", "706": "SO", "710": "ZA", "716": "ZW", "724": "ES",
  "728": "SS", "729": "SD", "740": "SR", "748": "SZ", "752": "SE", "756": "CH", "760": "SY",
  "762": "TJ", "764": "TH", "768": "TG", "780": "TT", "784": "AE", "788": "TN", "792": "TR",
  "795": "TM", "800": "UG", "804": "UA", "807": "MK", "818": "EG", "826": "GB", "834": "TZ",
  "840": "US", "854": "BF", "858": "UY", "860": "UZ", "862": "VE", "887": "YE", "894": "ZM",
};

export interface CountryDatum {
  country: string;
  mentions: number;
  sentiment: number;
}

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const pc = pa.map((v, i) => Math.round(v + (pb[i]! - v) * Math.min(1, Math.max(0, t))));
  return `#${pc.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function colorFor(sentiment: number): string {
  const s = Math.max(-0.35, Math.min(0.35, sentiment));
  const t = Math.abs(s) / 0.35;
  if (sentiment > 0.06) return mix("#334155", "#22c55e", t);
  if (sentiment < -0.06) return mix("#334155", "#ef4444", t);
  return "#334155";
}

export function WorldMap({
  data,
  onSelect,
}: {
  data: CountryDatum[];
  onSelect?: (country: string) => void;
}) {
  const byCountry = new Map(data.map((d) => [d.country, d]));
  return (
    <div className="w-full">
      <ComposableMap projection="geoEqualEarth" width={800} height={380}>
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: unknown[] }) =>
            geographies.map((geo) => {
              const id = String((geo as { id?: string | number }).id ?? "").padStart(3, "0");
              const iso2 = NUM_TO_ISO2[id];
              const d = iso2 ? byCountry.get(iso2) : undefined;
              return (
                <Geography
                  key={String((geo as { rsmKey?: string }).rsmKey ?? id)}
                  geography={geo as never}
                  fill={d ? colorFor(d.sentiment) : "#1b2536"}
                  stroke="#0b1120"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: "none" },
                    hover: {
                      fill: d ? "#38bdf8" : "#243044",
                      outline: "none",
                      cursor: d && onSelect ? "pointer" : "default",
                    },
                    pressed: { outline: "none" },
                  }}
                  onClick={() => {
                    if (d && onSelect && iso2) onSelect(iso2);
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2 w-4 rounded" style={{ background: colorFor(-0.35) }} /> negatif</span>
        <span className="flex items-center gap-1"><span className="h-2 w-4 rounded" style={{ background: colorFor(0) }} /> netral</span>
        <span className="flex items-center gap-1"><span className="h-2 w-4 rounded" style={{ background: colorFor(0.35) }} /> positif</span>
      </div>
    </div>
  );
}
