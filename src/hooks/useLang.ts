"use client";
import { useState, useEffect, useCallback } from "react";
import { translations, Lang, TranslationKey } from "@/lib/i18n";

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
    return (translations[lang] as Record<string, string>)[key]
      ?? (translations["fr"] as Record<string, string>)[key]
      ?? key;
  }, [lang]);

  return { lang, setLang, t };
}
