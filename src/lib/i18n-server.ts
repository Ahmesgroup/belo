// ============================================================
// lib/i18n-server.ts — Server-side translation helper
//
// Used in Server Components (layouts, pages) where React hooks
// are not available. Never import this in "use client" files.
//
// Usage:
//   const t = getTranslations("fr");
//   t("hero_title")           // flat key
//   t("common.hero_title")    // namespaced key
// ============================================================

import { translations, type Lang, type TranslationKey } from "@/lib/i18n";

export const SUPPORTED_LANGS = ["fr", "en"] as const;
export type SupportedLang = typeof SUPPORTED_LANGS[number];

/** Normalises any string to a supported language, defaulting to "fr". */
export function normalizeLang(lang: string): SupportedLang {
  return SUPPORTED_LANGS.includes(lang as SupportedLang)
    ? (lang as SupportedLang)
    : "fr";
}

/** Returns true when the given string is a supported language code. */
export function isValidLang(lang: string): lang is SupportedLang {
  return SUPPORTED_LANGS.includes(lang as SupportedLang);
}

type NSTranslations = Record<string, Record<string, string>>;

/**
 * Returns a synchronous `t()` function for use in Server Components.
 *
 * @param lang — language code, e.g. "fr" | "en"
 *
 * @example
 *   const t = getTranslations("en");
 *   t("hero_title")          // → "Beauty, booked"
 *   t("booking.how_title")   // → "Book in 4 steps"
 */
export function getTranslations(lang: string) {
  const l        = normalizeLang(lang);
  const langT    = translations[l]    as NSTranslations;
  const fallback = translations["fr"] as NSTranslations;

  return function t(key: TranslationKey): string {
    const k = key as string;

    if (k.includes(".")) {
      const [ns, name] = k.split(".") as [string, string];
      return langT[ns]?.[name] ?? fallback[ns]?.[name] ?? k;
    }

    for (const ns of Object.keys(langT)) {
      if (langT[ns]?.[k] !== undefined) return langT[ns][k];
    }
    for (const ns of Object.keys(fallback)) {
      if (fallback[ns]?.[k] !== undefined) return fallback[ns][k];
    }
    return k; // fallback: return key itself
  };
}

/** SEO metadata strings per language. */
export const SEO_META = {
  fr: {
    title:        "Belo — La beauté réservée en 45 secondes",
    titleTemplate:"%s | Belo",
    description:  "Réservez les meilleurs salons de coiffure et de beauté au Sénégal. Paiement Wave ou Orange Money. Confirmation WhatsApp instantanée.",
    keywords:     ["salon", "beauté", "coiffure", "réservation", "Dakar", "Sénégal", "Wave", "Orange Money"],
    locale:       "fr_SN",
  },
  en: {
    title:        "Belo — Beauty booked in 45 seconds",
    titleTemplate:"%s | Belo",
    description:  "Book the best hair and beauty salons in Senegal. Pay with Wave or Orange Money. Instant WhatsApp confirmation.",
    keywords:     ["salon", "beauty", "hair", "booking", "Dakar", "Senegal", "Wave", "Orange Money"],
    locale:       "en_US",
  },
} as const satisfies Record<SupportedLang, {
  title: string;
  titleTemplate: string;
  description: string;
  keywords: readonly string[];
  locale: string;
}>;
