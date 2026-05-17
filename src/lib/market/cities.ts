/**
 * Country → display city map.
 * Used by the editorial credit line on the homepage hero and SEO pages.
 *
 * Priority of usage:
 *   1. Explicit city from URL slug (/[lang]/salons/[city]/*)
 *   2. Country ISO from Vercel geo header (x-vercel-ip-country)
 *   3. Saved user country (future — user profile)
 *   4. Market default (africa → Dakar, europe → Paris)
 *
 * NEVER hardcode "Dakar" in components. Always read through this module.
 */

import type { Market } from "./theme";

// Country ISO → primary city display name
export const COUNTRY_PRIMARY_CITY: Record<string, string> = {
  // West & Central Africa
  SN: "Dakar",
  CI: "Abidjan",
  ML: "Bamako",
  GN: "Conakry",
  BF: "Ouagadougou",
  NE: "Niamey",
  TG: "Lomé",
  BJ: "Cotonou",
  CM: "Douala",
  CG: "Brazzaville",
  CD: "Kinshasa",
  GA: "Libreville",
  GH: "Accra",
  NG: "Lagos",

  // North Africa
  MA: "Casablanca",
  DZ: "Alger",
  TN: "Tunis",

  // East Africa
  KE: "Nairobi",
  UG: "Kampala",
  TZ: "Dar es Salaam",
  RW: "Kigali",
  ET: "Addis-Abeba",

  // Europe
  FR: "Paris",
  BE: "Bruxelles",
  LU: "Luxembourg",
  CH: "Genève",
  GB: "Londres",
  IE: "Dublin",
  ES: "Madrid",
  PT: "Lisbonne",
  IT: "Rome",
  DE: "Berlin",
  NL: "Amsterdam",
  AT: "Vienne",
  DK: "Copenhague",
  SE: "Stockholm",
  FI: "Helsinki",
  NO: "Oslo",

  // Americas (overflow)
  CA: "Montréal",
  US: "New York",
  BR: "São Paulo",

  // Middle East
  AE: "Dubaï",
  SA: "Riyadh",
};

// Country ISO → English display (for /en/* routes)
export const COUNTRY_PRIMARY_CITY_EN: Record<string, string> = {
  ...COUNTRY_PRIMARY_CITY,
  CH: "Geneva",
  GB: "London",
  DK: "Copenhagen",
  ES: "Madrid",
  PT: "Lisbon",
  IT: "Rome",
  AT: "Vienna",
  ET: "Addis Ababa",
  CA: "Montreal",
  BE: "Brussels",
  AE: "Dubai",
};

// Market → fallback city when country is unknown
const MARKET_DEFAULT_CITY: Record<Market, { fr: string; en: string }> = {
  africa: { fr: "Dakar",  en: "Dakar"  },
  europe: { fr: "Paris",  en: "Paris"  },
};

// ── PUBLIC HELPERS ───────────────────────────────────────────

export interface CityResolveInput {
  /** ISO country code from Vercel geo header */
  country?: string;
  /** Explicit city slug from URL (e.g. /fr/salons/dakar/*) */
  citySlug?: string;
  /** Detected market — used as fallback when country is unknown */
  market: Market;
  /** Display language */
  lang: "fr" | "en";
}

/**
 * Resolve the city to display in the editorial credit line.
 * Never returns null — always a meaningful city name.
 */
export function resolveDisplayCity(input: CityResolveInput): string {
  // 1. Explicit city slug (most specific)
  if (input.citySlug) {
    const slug = input.citySlug.toLowerCase();
    // Slugs are lowercase ASCII — find the canonical name from the country map
    const match = Object.values(input.lang === "en" ? COUNTRY_PRIMARY_CITY_EN : COUNTRY_PRIMARY_CITY)
      .find(name => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") === slug);
    if (match) return match;
    // Otherwise capitalise the slug — handles cities we haven't mapped yet
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }

  // 2. Country ISO from geo header
  if (input.country) {
    const map = input.lang === "en" ? COUNTRY_PRIMARY_CITY_EN : COUNTRY_PRIMARY_CITY;
    const city = map[input.country.toUpperCase()];
    if (city) return city;
  }

  // 3. Market default
  return MARKET_DEFAULT_CITY[input.market][input.lang];
}

/**
 * Build the editorial credit line for the hero:
 *   "Dakar edition · 120 salons"  (en)
 *   "Édition Dakar · 120 salons"  (fr)
 */
export function buildEditorialCredit(
  input: CityResolveInput,
  totalSalons: number,
): string {
  const city = resolveDisplayCity(input);
  const plural = totalSalons > 1 ? "s" : "";
  if (input.lang === "fr") {
    return `Édition ${city} · ${totalSalons} salon${plural}`;
  }
  return `${city} edition · ${totalSalons} salon${plural}`;
}
