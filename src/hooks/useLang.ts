"use client";
import { useState, useEffect, useCallback } from "react";
import { translations, Lang, TranslationKey } from "@/lib/i18n";

type NSTranslations = Record<string, Record<string, string>>;

export function useLang() {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    const saved = (localStorage.getItem("belo_lang") ?? "fr") as Lang;
    setLangState(saved);
    const handler = (e: Event) => setLangState((e as CustomEvent).detail as Lang);
    window.addEventListener("belo-lang-change", handler);
    return () => window.removeEventListener("belo-lang-change", handler);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("belo_lang", l);
    window.dispatchEvent(new CustomEvent("belo-lang-change", { detail: l }));
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    const langT = translations[lang] as NSTranslations;
    const frT   = translations["fr"] as NSTranslations;

    // Namespaced key: "common.nav_discover" or "booking.choose_service"
    if (key.includes(".")) {
      const [ns, k] = key.split(".") as [string, string];
      return langT[ns]?.[k] ?? frT[ns]?.[k] ?? key;
    }

    // Flat key — search all namespaces (backward compat with existing components)
    for (const ns of Object.keys(langT)) {
      if (langT[ns]?.[key] !== undefined) return langT[ns][key];
    }
    for (const ns of Object.keys(frT)) {
      if (frT[ns]?.[key] !== undefined) return frT[ns][key];
    }
    return key;
  }, [lang]);

  return { lang, setLang, t };
}
