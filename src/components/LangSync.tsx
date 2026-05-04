"use client";

import { useEffect } from "react";
import { useLang } from "@/hooks/useLang";
import type { SupportedLang } from "@/lib/i18n-server";

/**
 * LangSync — syncs the URL lang segment with the LangContext.
 *
 * Placed inside [lang]/layout.tsx. When the page renders at /en/salons,
 * this component fires on mount and sets the context lang to "en",
 * ensuring all client components (Nav, buttons, etc.) show the correct
 * language without requiring a full page reload.
 */
export default function LangSync({ lang }: { lang: SupportedLang }) {
  const { lang: currentLang, setLang } = useLang();

  useEffect(() => {
    if (lang !== currentLang) {
      setLang(lang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return null;
}
