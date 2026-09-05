import type { FetchOptions, FetchResult, SourceName } from "./types";
import { fetchReddit } from "./reddit";
import { fetchYoutube } from "./youtube";
import { fetchGplay } from "./gplay";
import { fetchTavily } from "./tavily";

export * from "./types";
export { fetchReddit } from "./reddit";
export { fetchYoutube } from "./youtube";
export { fetchGplay } from "./gplay";
export { fetchTavily } from "./tavily";

export const CONNECTORS: Record<SourceName, (o: FetchOptions) => Promise<FetchResult>> = {
  reddit: fetchReddit,
  youtube: fetchYoutube,
  gplay: fetchGplay,
  tavily: fetchTavily,
};
