"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { translations, type Lang, type TranslationKey } from "@/lib/i18n";

// ── Types ────────────────────────────────────────────────────────

type NSTranslations = Record<string, Record<string, string>>;

interface LangContextValue {
  lang: Lang;
  /** Change the active language and persist to localStorage. */
  setLang: (l: Lang) => void;
  /** Resolve a translation key (supports both "flat_key" and "ns.key" forms). */
  t: (key: TranslationKey) => string;
}

// ── Context ──────────────────────────────────────────────────────

const LangContext = createContext<LangContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────

export function LangProvider({
  children,
  initialLang,
}: {
  children:     ReactNode;
  initialLang?: Lang;
}) {
  // initialLang (from URL [lang] segment) takes precedence, avoiding a
  // flash when navigating /en/* routes. Falls back to "fr" for non-lang paths.
  const [lang, setLangState] = useState<Lang>(initialLang ?? "fr");

  useEffect(() => {
    const saved = (localStorage.getItem("belo_lang") ?? "fr") as Lang;
    setLangState(saved);

    // Keep all instances in sync when the language changes from any component.
    const handler = (e: Event) =>
      setLangState((e as CustomEvent<Lang>).detail);
    window.addEventListener("belo-lang-change", handler);
    return () => window.removeEventListener("belo-lang-change", handler);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("belo_lang", l);
    window.dispatchEvent(new CustomEvent("belo-lang-change", { detail: l }));
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      const langT = translations[lang] as NSTranslations;
      const frT   = translations["fr"]  as NSTranslations;

      // Namespaced key: "common.hero_title"
      if ((key as string).includes(".")) {
        const [ns, k] = (key as string).split(".") as [string, string];
        return langT[ns]?.[k] ?? frT[ns]?.[k] ?? (key as string);
      }

      // Flat key: search every namespace
      for (const ns of Object.keys(langT)) {
        if (langT[ns]?.[key as string] !== undefined) return langT[ns][key as string];
      }
      for (const ns of Object.keys(frT)) {
        if (frT[ns]?.[key as string] !== undefined) return frT[ns][key as string];
      }
      return key as string;
    },
    [lang]
  );

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error("useLang() must be used inside <LangProvider>.");
  }
  return ctx;
}
