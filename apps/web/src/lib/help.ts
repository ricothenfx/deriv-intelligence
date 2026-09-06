export const HELP = {
  mentions:
    "Total posts/comments/reviews about Deriv collected from all channels (Reddit, YouTube, Google Play, web) in the selected period. The delta compares against the previous period of the same length.",
  weighted_sentiment:
    "Average sentiment from -1 (very negative) to +1 (very positive), weighted by engagement — posts with many views/likes/comments carry more influence than quiet ones.",
  negative_share:
    "Percentage of mentions the AI classified as negative. Breakdown: negative, positive, and mixed (both positive and negative) counts.",
  countries_tracked:
    "Number of countries detected in the data. Location is inferred from the Google Play review country (exact), language, subreddit, and website domain — always with a confidence score.",
  open_alerts:
    "Active anomalies detected automatically (complaint spikes or unusual sentiment drops). Click to see details and the incident timeline.",
  volume_sentiment:
    "Line/bar chart: volume = mentions per day (bars), sentiment = weighted daily average (line). Red = negative, green = positive.",
  sentiment_by_country:
    "Countries ranked by mention count. First number = weighted sentiment (-1..+1), second = mention count. Click a country to open the map detail page.",
  sentiment_by_platform:
    "Which channel the mentions come from (reddit/youtube/gplay/tavily) and how sentiment differs per channel.",
  topics_table:
    "Most-discussed topics in the last 7 days. Share = portion of total mentions; sentiment = weighted average for that topic. Click a row to see trends and example mentions.",
  journey_funnel:
    "User journey stages inferred by AI from post content: signup → KYC → deposit → trading → withdrawal → support. Bars = mentions per stage; numbers = average sentiment for that stage. The reddest stage is the biggest pain point.",
  dominant_negative_aspects:
    "Most-complained-about product aspects (e.g. 'withdrawal delay', 'kyc'), with the journey stage where the complaints appear.",
  emerging_topics:
    "Topics whose discussion grew significantly this week versus last week — an early signal of an issue that is getting bigger.",
  hourly_pattern:
    "Users' local hour (not server time) when the post was made. Late-night complaint patterns usually indicate urgent service problems.",
  evidence:
    "Highest-impact original post quotes (sentiment × engagement). Click the source link to open the original post in a new tab and verify or reply directly.",
  data_sources:
    "Data fetch status per channel: when data was last grabbed, the automatic schedule (cron), and a button to fetch fresh data now without waiting for the schedule.",
  last_grab: "The last time the worker successfully fetched data from this channel (from the query_state table).",
  grab_now:
    "Fetch the latest data from this channel right now. The job is sent to the worker queue — new data appears shortly after it finishes (AI enrichment runs afterwards).",
  grab_all: "Fetch the latest data from ALL channels at once, right now.",
  map_country:
    "World map: color = sentiment (red negative, green positive), intensity = mention count. Click a country for details.",
  latest_mentions: "Newest posts from the selected country. The source link opens the original post in a new tab.",
  funnel_aspect: "Cross table: which complaint aspects dominate each user journey stage.",
  alerts_zscore:
    "z-score = how far the current value deviates from the normal average, in standard deviations. Above ~3 means a statistically real anomaly.",
  alerts_baseline: "baseline = the normal average value; observed = what happened in the last 2-hour window.",
  alerts_confidence: "How confident the detector is that this is a real anomaly (not random noise).",
  alerts_timeline: "Chronology of the anomaly: when it was detected, confirmed, and how it evolved.",
  share_of_voice: "The share of conversation about each brand out of all monitored brand conversations.",
  brand_sentiment: "Sentiment comparison across brands — Deriv vs competitors (Exness, IQ Option, OctaFX).",
  aspect_matrix: "Sentiment per product aspect (withdrawal, platform, etc.) across brands — where Deriv leads or lags.",
  switchers: "Real posts from users saying they switched from one brand to another. Click the source to read the original post.",
  kol_score:
    "Influence score = total engagement × posting frequency × negative impact, boosted by channel reach (subscribers) when known. High score + many complaints = reputational risk; high score + positive = advocate candidate.",
  kol_profile: "Click an author name to open their original profile/channel in a new tab (Reddit/YouTube).",
  kol_example: "A recent post from this author — click to open it in a new tab.",
  kol_reach: "Channel size: YouTube subscriber count when known. Bigger reach = bigger impact per post. '—' for individual accounts (Reddit users, commenters).",
  version_rating: "Average star rating of Google Play reviews that mention this app version.",
  version_sentiment: "AI sentiment from the review text for this version — can differ from the star rating.",
  version_aspects: "Main complaints/praise for this version; red = complaints, green = praise.",
  correlation_r:
    "Pearson r (-1..+1): how strongly two metrics move together. Above 0.4 or below -0.4 = a meaningful relationship (not necessarily causal).",
  search_score: "Relevance score of the search result (keyword match + semantic similarity combined).",
  search_brand: "Only mentions about the selected brand are searched. Switch to 'All brands' to include competitor and unbranded posts.",
  ask_tab: "Ask questions in free-form language — the AI answers from the collected data, including the aggregations it used.",
  draft_reply: "The AI drafts a reply (in the original post's language) that you can copy to the source platform.",
  faq_generated: "The most frequent questions from real data, answered automatically by AI in the user's language.",
  tickets: "Replies you flagged as 'escalate' from the Search page land in the queue here.",
  llm_costs: "Estimated AI (LLM) usage cost per purpose: sentiment enrichment, chat, copilot, etc.",
  bot_filter: "Posts detected as bot/spam are automatically excluded from all analytics.",
  enrichment: "Every post is analyzed by AI: sentiment, emotion, complaint aspects, topics, journey stage, country, and bot detection.",
  translate: "Show an AI-generated English translation of this post. The original language is preserved; translations are cached so they are only computed once.",
  keywords_page:
    "The search keywords actively used per channel to collect data. Edit them to broaden or narrow what the pipeline collects — changes apply to the next scheduled or manual grab.",
  keywords_edit:
    "Add keywords with the input, remove them with ×, then Save. Order matters for quota-limited channels (YouTube runs the first keywords first). 'Reset to defaults' restores the environment defaults.",
} as const;

export type HelpKey = keyof typeof HELP;

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GLOSSARY: { section: string; entries: GlossaryEntry[] }[] = [
  {
    section: "Core metrics",
    entries: [
      { term: "Mention", definition: "One unit of data: a Reddit post, YouTube comment, Google Play review, or web article mentioning a monitored brand." },
      { term: "Sentiment", definition: "AI classification: positive / negative / neutral / mixed, with a score from -1 to +1 and a confidence level." },
      { term: "Weighted sentiment", definition: "Engagement-weighted average sentiment. Popular posts (many views/likes/comments) get more influence." },
      { term: "Engagement", definition: "Interactions on the original post: Reddit score/upvotes, YouTube views/likes, Google Play thumbs-up. Used to weight influence." },
      { term: "Share of voice", definition: "The percentage of conversation about one brand compared to all monitored brands." },
    ],
  },
  {
    section: "AI enrichment",
    entries: [
      { term: "Aspect", definition: "A specific thing being discussed, e.g. 'withdrawal delay', 'kyc document', 'app crash' — inferred by AI from the text." },
      { term: "Topic", definition: "A broader topic label than aspect, used for trend tracking and per-topic anomaly detection." },
      { term: "Journey stage", definition: "The user journey stage: signup, kyc, deposit, trading, withdrawal, support — shows where users get stuck." },
      { term: "Location (located)", definition: "The country a mention came from, inferred from Google Play country (high confidence), language, subreddit, or domain. Not every mention can be located." },
      { term: "Local hour", definition: "The user's local hour when posting — used for 'late-night complaints' patterns." },
      { term: "Bot detection", definition: "AI flags spam/bot posts; flagged posts are excluded from all analytics numbers." },
      { term: "Brand tag", definition: "Brands explicitly named in the text (Deriv, Exness, IQ Option, OctaFX). Analytics default to Deriv-only; competitor posts are kept for benchmarking." },
    ],
  },
  {
    section: "Detection & alerting",
    entries: [
      { term: "z-score", definition: "How far the current value deviates from normal, in standard deviations. Above ~3 = a real anomaly." },
      { term: "Baseline", definition: "The normal average value used as the comparison for anomaly detection." },
      { term: "Severity", definition: "Alert severity: low, medium, high, critical — derived from z-score, confidence, and impact." },
    ],
  },
  {
    section: "Data sources & pipeline",
    entries: [
      { term: "Reddit", definition: "Posts and comments from keyword search (OAuth API), plus subreddit-scoped searches. Source links point to the original thread." },
      { term: "YouTube", definition: "Videos (title, description, statistics, channel subscribers) + top comments. Comment links point directly to the comment." },
      { term: "Google Play", definition: "App reviews per country (including star rating and app version). Links point to the review on the Play Store." },
      { term: "Tavily (web/news)", definition: "News and web articles mentioning the brand, found via the Tavily API." },
      { term: "Grab / cron", definition: "Scheduled automatic fetching: Reddit every 15 minutes; YouTube & Google Play hourly; web every 6 hours. Can also be triggered manually from the dashboard." },
      { term: "Keywords", definition: "The search terms used per channel when grabbing data. Editable on the Keywords page; changes apply from the next grab." },
      { term: "Enrichment queue", definition: "After a grab, each item enters an AI analysis queue. Analytics numbers grow gradually until the queue drains." },
    ],
  },
];
