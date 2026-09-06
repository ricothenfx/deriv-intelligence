"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { postJson } from "@/lib/api";
import { HELP } from "@/lib/help";

interface TranslateResponse {
  item_id: number;
  language: string | null;
  translation: string;
  cached: boolean;
}

export function TranslateButton({ itemId, language }: { itemId: number; language?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);

  if (language && language.toLowerCase().startsWith("en")) return null;

  const translate = async () => {
    if (loading || translation) return;
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<TranslateResponse>("/api/translate", { item_id: itemId });
      setTranslation(res.translation);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex flex-col gap-1" title={HELP.translate}>
      <button
        onClick={translate}
        disabled={loading || !!translation}
        className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline disabled:opacity-50"
      >
        <Languages size={11} className="shrink-0" />
        {loading ? "translating…" : translation ? "translated ✓" : "Translate to English"}
      </button>
      {error && <span className="text-[10px] text-rose-300">{error}</span>}
      {translation && (
        <p className="whitespace-pre-wrap rounded border border-slate-700/60 bg-slate-950/60 p-2 text-[11px] italic leading-relaxed text-slate-300">
          <span className="mr-1 not-italic text-slate-500">AI translation:</span>
          {translation}
        </p>
      )}
    </span>
  );
}
