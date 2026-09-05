import { createHash } from "crypto";
import type { NormalizedItem } from "@deriv-intel/connectors";

export function cleanText(input: string): string {
  return input
    .replace(/\r/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 6000);
}

export function contentHash(source: string, content: string): string {
  const norm = content.toLowerCase().replace(/[^a-z0-9\u00c0-\uffff]+/gi, " ").trim();
  return createHash("sha1").update(`${source}::${norm}`).digest("hex");
}

export function engagementScore(item: NormalizedItem): number {
  const e = item.engagement as Record<string, unknown>;
  const n = (k: string) => Number(e[k] ?? 0) || 0;
  const meta = item.metadata as Record<string, unknown>;
  switch (item.source) {
    case "reddit":
      return n("score") + n("comments") * 2;
    case "youtube":
      return meta.kind === "video"
        ? Math.log10(1 + n("viewCount")) * 10
        : n("likes") * 3 + 1;
    case "gplay":
      return 1 + n("thumbsUp");
    default:
      return 1;
  }
}
