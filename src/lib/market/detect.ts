/**
 * Market detection — derives the cultural atmosphere from signals.
 *
 * Priority order (most specific → most general) :
 *   1. Explicit `?market=` query param (manual override, testing)
 *   2. City segment in URL (/fr/salons/dakar/* → africa)
 *   3. Country ISO from geo headers (future — IP geolocation)
 *   4. Language fallback (fr → africa, en → europe)
 *
 * Africa is the launch primary market — when in doubt, choose africa.
 */

import type { Market } from "./theme";

// Cities → market (extend as Belo expands)
const AFRICA_CITIES = new Set([
  "dakar",     "thies",      "ziguinchor", "saint-louis", "kaolack",
  "touba",     "mbour",      "rufisque",   "kolda",       "tambacounda",
  "abidjan",   "bouake",     "yamoussoukro",
  "bamako",    "kayes",      "sikasso",
  "conakry",   "douala",     "yaounde",
  "casablanca","rabat",      "marrakech",  "tanger",
  "tunis",     "alger",      "oran",
  "ouagadougou", "lome",     "cotonou",    "niamey",
  "accra",     "lagos",      "abuja",      "nairobi", "kampala",
]);

const EUROPE_CITIES = new Set([
  "paris",      "lyon",        "marseille",  "bordeaux", "nantes",
  "lille",      "strasbourg",  "toulouse",   "nice",     "rennes",
  "bruxelles",  "anvers",      "gand",       "liege",
  "luxembourg",
  "geneve",     "zurich",      "lausanne",   "bern",
  "london",     "manchester",  "edinburgh",
  "madrid",     "barcelona",   "valencia",
  "lisbonne",   "porto",
  "rome",       "milan",       "florence",
  "berlin",     "munich",      "hamburg",
  "amsterdam",  "rotterdam",
]);

const EUROPE_COUNTRIES = new Set([
  "FR", "BE", "LU", "CH", "GB", "ES", "PT", "IT", "DE", "NL", "IE", "DK", "SE", "FI", "NO", "AT",
]);

export interface DetectInput {
  /** URL language segment (fr, en). */
  lang?:    string;
  /** City slug from URL (when on /[lang]/salons/[city]/[category]). */
  city?:    string;
  /** ISO 3166 country code (from geo IP — future). */
  country?: string;
  /** Manual override via ?market=africa|europe. */
  override?: string;
}

export function detectMarket(input: DetectInput = {}): Market {
  // 1. Explicit override (highest priority)
  if (input.override === "africa" || input.override === "europe") {
    return input.override;
  }

  // 2. City signal (most specific)
  if (input.city) {
    const slug = input.city.toLowerCase();
    if (AFRICA_CITIES.has(slug)) return "africa";
    if (EUROPE_CITIES.has(slug)) return "europe";
  }

  // 3. Country ISO (geo IP)
  if (input.country) {
    if (EUROPE_COUNTRIES.has(input.country.toUpperCase())) return "europe";
  }

  // 4. Language fallback
  if (input.lang === "en") return "europe";

  // Default — Senegal-first launch
  return "africa";
}
