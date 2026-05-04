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

// Prisma returns Json fields as `unknown`; after parsing they are objects.
// Accept the broad Record shape so callers don't need to cast.
export type LocalizedField =
  | { fr: string; en: string }
  | Record<string, string>
  | string
  | null
  | undefined;

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
  const obj = field as Record<string, string>;
  return obj[l] ?? obj["fr"] ?? fallback;
}
