import { chatText, modelFor, parseJson } from "@deriv-intel/llm";
import { query, withTx } from "./db";

export interface TranslationResult {
  item_id: number;
  language: string | null;
  translation: string;
  cached: boolean;
}

interface ItemRow {
  id: number;
  title: string | null;
  content: string;
  language: string | null;
}

const SYSTEM_PROMPT = `You are a professional translator for a social-listening platform.
Translate the given social post / app review / article excerpt into natural English.
Rules:
- Preserve tone, meaning, line breaks, and emojis.
- Keep untranslatable slang, add a short bracketed explanation (e.g. "wd [Indonesian slang for withdrawal]").
- Do not answer, comment on, or summarize the text — translation only.
Return strict JSON {"translation":"..."}.`;

export async function translateItem(itemId: number): Promise<TranslationResult | null> {
  const rows = await query<ItemRow>(
    `select i.id, i.title, i.content, coalesce(e.language, i.language) as language
     from items i left join item_enrichments e on e.item_id = i.id
     where i.id = $1`,
    [itemId],
  );
  const item = rows[0];
  if (!item) return null;

  const cached = await query<{ text: string; language: string | null }>(
    `select text, language from item_translations where item_id = $1`,
    [itemId],
  );
  if (cached[0]) {
    return { item_id: itemId, language: cached[0].language, translation: cached[0].text, cached: true };
  }

  const sourceText = `${item.title ? item.title + "\n\n" : ""}${item.content}`.slice(0, 4000);

  if ((item.language ?? "").toLowerCase().startsWith("en")) {
    const result = { item_id: itemId, language: item.language, translation: sourceText, cached: true };
    await withTx(async (c) => {
      await c.query(
        `insert into item_translations (item_id, text, language, llm_model) values ($1, $2, $3, null)
         on conflict (item_id) do nothing`,
        [itemId, sourceText, item.language],
      );
    });
    return result;
  }

  const raw = await chatText({
    tier: "cheap",
    purpose: "translate",
    source: String(itemId),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: sourceText },
    ],
    json: true,
    temperature: 0,
    maxTokens: 2000,
  });

  let translation = "";
  try {
    const parsed = parseJson<{ translation?: string }>(raw);
    translation = String(parsed.translation ?? "").trim();
  } catch {
    translation = raw.trim();
  }
  if (!translation) throw new Error("translation model returned empty output");

  const model = modelFor("cheap");
  await withTx(async (c) => {
    await c.query(
      `insert into item_translations (item_id, text, language, llm_model) values ($1, $2, $3, $4)
       on conflict (item_id) do nothing`,
      [itemId, translation, item.language, model],
    );
  });

  return { item_id: itemId, language: item.language, translation, cached: false };
}
