// ============================================================
// lib/phone.ts — Phone number utilities
//
// E.164 formatting, validation, and country metadata.
// No external dependencies — avoids heavy libphonenumber-js bundle.
// ============================================================

export interface Country {
  iso:      string;   // ISO 3166-1 alpha-2
  dial:     string;   // dial code without +
  flag:     string;   // emoji
  name:     string;
  nameFr:   string;
  pattern?: RegExp;   // local number pattern for validation hint
  example?: string;   // placeholder example
}

// ── Full country list ─────────────────────────────────────────
// Sorted: Africa first (primary market), then Europe, then rest

export const COUNTRIES: Country[] = [
  // ── Afrique ─────────────────────────────────────────────────
  { iso:"SN", dial:"221", flag:"🇸🇳", name:"Senegal",       nameFr:"Sénégal",        example:"77 123 45 67", pattern:/^[5-9]\d{7,8}$/ },
  { iso:"CI", dial:"225", flag:"🇨🇮", name:"Ivory Coast",   nameFr:"Côte d'Ivoire",  example:"07 12 34 56 78", pattern:/^[0-9]\d{9}$/ },
  { iso:"ML", dial:"223", flag:"🇲🇱", name:"Mali",          nameFr:"Mali",            example:"79 12 34 56", pattern:/^\d{8}$/ },
  { iso:"GN", dial:"224", flag:"🇬🇳", name:"Guinea",        nameFr:"Guinée",          example:"621 23 45 67", pattern:/^\d{9}$/ },
  { iso:"BF", dial:"226", flag:"🇧🇫", name:"Burkina Faso",  nameFr:"Burkina Faso",    example:"70 12 34 56" },
  { iso:"NE", dial:"227", flag:"🇳🇪", name:"Niger",         nameFr:"Niger",           example:"90 12 34 56" },
  { iso:"TG", dial:"228", flag:"🇹🇬", name:"Togo",          nameFr:"Togo",            example:"90 12 34 56" },
  { iso:"BJ", dial:"229", flag:"🇧🇯", name:"Benin",         nameFr:"Bénin",           example:"90 12 34 56" },
  { iso:"MR", dial:"222", flag:"🇲🇷", name:"Mauritania",    nameFr:"Mauritanie",      example:"22 12 34 56" },
  { iso:"GM", dial:"220", flag:"🇬🇲", name:"Gambia",        nameFr:"Gambie",          example:"90 12 34 56" },
  { iso:"GW", dial:"245", flag:"🇬🇼", name:"Guinea-Bissau", nameFr:"Guinée-Bissau",   example:"95 123 45 67" },
  { iso:"CV", dial:"238", flag:"🇨🇻", name:"Cape Verde",    nameFr:"Cap-Vert",        example:"991 23 45" },
  { iso:"GH", dial:"233", flag:"🇬🇭", name:"Ghana",         nameFr:"Ghana",           example:"20 123 4567" },
  { iso:"NG", dial:"234", flag:"🇳🇬", name:"Nigeria",       nameFr:"Nigeria",         example:"802 123 4567" },
  { iso:"MA", dial:"212", flag:"🇲🇦", name:"Morocco",       nameFr:"Maroc",           example:"612 34 56 78" },
  { iso:"DZ", dial:"213", flag:"🇩🇿", name:"Algeria",       nameFr:"Algérie",         example:"551 23 45 67" },
  { iso:"TN", dial:"216", flag:"🇹🇳", name:"Tunisia",       nameFr:"Tunisie",         example:"20 123 456" },
  { iso:"LY", dial:"218", flag:"🇱🇾", name:"Libya",         nameFr:"Libye",           example:"91 123 4567" },
  { iso:"EG", dial:"20",  flag:"🇪🇬", name:"Egypt",         nameFr:"Égypte",          example:"100 123 4567" },
  { iso:"CM", dial:"237", flag:"🇨🇲", name:"Cameroon",      nameFr:"Cameroun",        example:"690 12 34 56" },
  { iso:"GA", dial:"241", flag:"🇬🇦", name:"Gabon",         nameFr:"Gabon",           example:"074 12 34 56" },
  { iso:"CG", dial:"242", flag:"🇨🇬", name:"Congo",         nameFr:"Congo",           example:"06 123 4567" },
  { iso:"CD", dial:"243", flag:"🇨🇩", name:"DR Congo",      nameFr:"RD Congo",        example:"812 345 678" },
  { iso:"KE", dial:"254", flag:"🇰🇪", name:"Kenya",         nameFr:"Kenya",           example:"712 345 678" },
  { iso:"ZA", dial:"27",  flag:"🇿🇦", name:"South Africa",  nameFr:"Afrique du Sud",  example:"71 234 5678" },
  { iso:"ET", dial:"251", flag:"🇪🇹", name:"Ethiopia",      nameFr:"Éthiopie",        example:"91 234 5678" },
  // ── Europe ──────────────────────────────────────────────────
  { iso:"FR", dial:"33",  flag:"🇫🇷", name:"France",        nameFr:"France",          example:"6 12 34 56 78", pattern:/^[67]\d{8}$/ },
  { iso:"BE", dial:"32",  flag:"🇧🇪", name:"Belgium",       nameFr:"Belgique",        example:"471 23 45 67", pattern:/^[4-9]\d{7,8}$/ },
  { iso:"LU", dial:"352", flag:"🇱🇺", name:"Luxembourg",    nameFr:"Luxembourg",      example:"621 234 567", pattern:/^\d{6,9}$/ },
  { iso:"DE", dial:"49",  flag:"🇩🇪", name:"Germany",       nameFr:"Allemagne",       example:"151 23456789" },
  { iso:"CH", dial:"41",  flag:"🇨🇭", name:"Switzerland",   nameFr:"Suisse",          example:"78 123 45 67" },
  { iso:"IT", dial:"39",  flag:"🇮🇹", name:"Italy",         nameFr:"Italie",          example:"312 345 6789" },
  { iso:"ES", dial:"34",  flag:"🇪🇸", name:"Spain",         nameFr:"Espagne",         example:"612 345 678" },
  { iso:"PT", dial:"351", flag:"🇵🇹", name:"Portugal",      nameFr:"Portugal",        example:"912 345 678" },
  { iso:"NL", dial:"31",  flag:"🇳🇱", name:"Netherlands",   nameFr:"Pays-Bas",        example:"6 12345678" },
  { iso:"GB", dial:"44",  flag:"🇬🇧", name:"United Kingdom",nameFr:"Royaume-Uni",     example:"7911 123456" },
  { iso:"IE", dial:"353", flag:"🇮🇪", name:"Ireland",       nameFr:"Irlande",         example:"85 123 4567" },
  { iso:"SE", dial:"46",  flag:"🇸🇪", name:"Sweden",        nameFr:"Suède",           example:"70 123 45 67" },
  { iso:"NO", dial:"47",  flag:"🇳🇴", name:"Norway",        nameFr:"Norvège",         example:"412 34 567" },
  { iso:"DK", dial:"45",  flag:"🇩🇰", name:"Denmark",       nameFr:"Danemark",        example:"20 12 34 56" },
  { iso:"PL", dial:"48",  flag:"🇵🇱", name:"Poland",        nameFr:"Pologne",         example:"512 345 678" },
  // ── Americas ────────────────────────────────────────────────
  { iso:"US", dial:"1",   flag:"🇺🇸", name:"United States", nameFr:"États-Unis",      example:"(555) 123-4567" },
  { iso:"CA", dial:"1",   flag:"🇨🇦", name:"Canada",        nameFr:"Canada",          example:"(555) 123-4567" },
  { iso:"BR", dial:"55",  flag:"🇧🇷", name:"Brazil",        nameFr:"Brésil",          example:"11 91234-5678" },
  { iso:"MX", dial:"52",  flag:"🇲🇽", name:"Mexico",        nameFr:"Mexique",         example:"1 234 567 8901" },
  // ── Middle East & Asia ───────────────────────────────────────
  { iso:"SA", dial:"966", flag:"🇸🇦", name:"Saudi Arabia",  nameFr:"Arabie Saoudite", example:"51 234 5678" },
  { iso:"AE", dial:"971", flag:"🇦🇪", name:"UAE",           nameFr:"Émirats Arabes",  example:"50 123 4567" },
  { iso:"TR", dial:"90",  flag:"🇹🇷", name:"Turkey",        nameFr:"Turquie",         example:"532 123 45 67" },
  { iso:"IN", dial:"91",  flag:"🇮🇳", name:"India",         nameFr:"Inde",            example:"98765 43210" },
  { iso:"CN", dial:"86",  flag:"🇨🇳", name:"China",         nameFr:"Chine",           example:"131 2345 6789" },
  { iso:"JP", dial:"81",  flag:"🇯🇵", name:"Japan",         nameFr:"Japon",           example:"90 1234 5678" },
];

// ── Lookup helpers ────────────────────────────────────────────

/** Find country by dial code (prefers longest match). */
export function findCountryByDial(dial: string): Country | undefined {
  return COUNTRIES.find(c => c.dial === dial);
}

/** Find country by ISO code. */
export function findCountryByISO(iso: string): Country | undefined {
  return COUNTRIES.find(c => c.iso === iso.toUpperCase());
}

/** Detect default country from browser locale. */
export function detectDefaultCountry(): Country {
  if (typeof navigator === "undefined") return COUNTRIES[0]; // SSR fallback → SN
  const lang = navigator.language ?? "fr-SN";
  const region = lang.split("-")[1]?.toUpperCase();
  if (region) {
    const found = findCountryByISO(region);
    if (found) return found;
  }
  return COUNTRIES[0]; // default: Sénégal
}

// ── E.164 utilities ───────────────────────────────────────────

/** Build E.164 from dial code + local number. */
export function toE164(dial: string, local: string): string {
  const digits = local.replace(/\D/g, "");
  return `+${dial}${digits}`;
}

/** Validate a local number for a given country (best-effort). */
export function isValidLocalNumber(local: string, country: Country): boolean {
  const digits = local.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15) return false;
  if (country.pattern) return country.pattern.test(digits);
  return digits.length >= 6;
}

/** Validate full E.164 string. */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone.replace(/\s/g, ""));
}

/** Normalise any phone string to E.164. */
export function normalizePhone(raw: string, dial = "221"): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  // If digits already start with the dial code, don't double it
  if (digits.startsWith(dial) && digits.length > dial.length) {
    return `+${digits}`;
  }
  return `+${dial}${digits}`;
}

/**
 * Split a saved E.164 number back into { country, local }.
 * Tries longest dial prefix first.
 */
export function splitE164(e164: string): { country: Country; local: string } {
  const digits = e164.replace(/^\+/, "");
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (digits.startsWith(c.dial)) {
      return { country: c, local: digits.slice(c.dial.length) };
    }
  }
  return { country: COUNTRIES[0], local: digits };
}
