// ============================================================
// lib/i18n-localize.ts — getLocalized() helper
//
// Resolves a multilingual JSON field { fr: "...", en: "..." }
// to the correct string for the given language.
//
// Usage (server):
//   getLocalized(city.name, "en")  → "Dakar"
//   getLocalized(city.name, "fr")  → "Dakar"
// ============================================================

export type LocalizedField = { fr: string; en: string } | string | null | undefined;

/**
 * Extracts the localised string from a JSON bilingual field.
 * Falls back to French, then to the raw value, then to the fallback arg.
 */
export function getLocalized(
  field:    LocalizedField,
  lang:     string,
  fallback: string = ""
): string {
  if (!field) return fallback;
  if (typeof field === "string") return field;

  const l = lang === "en" ? "en" : "fr";
  return (field as any)[l] ?? (field as any).fr ?? fallback;
}
