"use client";

/**
 * SearchBar — surface unique, organique, sans bordures dures.
 *
 * RÈGLES :
 * - Une seule surface translucide (rgba blanc 55% + backdrop-blur 14)
 * - Aucun input/champ visible : tout fond transparent
 * - Séparateur hairline ultra subtil (1px / 4% opacity)
 * - Focus glow champagne (jamais vert)
 * - Vert Belo réservé strictement au CTA "Chercher"
 * - Radius 32px — organique
 * - Shadow 0 8px 30px rgba(36,28,24,.04) — imperceptible
 */

import { useRouter }    from "next/navigation";
import { useState, useTransition } from "react";
import { getIntentColor } from "@/lib/design/intent";
import type { SupportedLang } from "@/lib/i18n-server";

interface SearchBarProps {
  lang:             SupportedLang;
  placeholder?:     string;
  cityPlaceholder?: string;
  buttonLabel?:     string;
  defaultSearch?:   string;
  defaultCity?:     string;
  className?:       string;
}

const QUICK_CITIES: string[] = [
  "Dakar", "Abidjan", "Casablanca", "Paris", "Bruxelles", "Luxembourg",
  "Thiès",  "Bamako",   "Rabat",      "Lyon",  "London", "Genève",
  "Lisbonne", "Madrid", "Marseille", "Bordeaux", "Nantes",
];

// Predictive service categories — bilingual, matched against user typing.
// Each entry routes to /[lang]/salons?cat=<slug>.
interface ServiceSuggestion {
  slug:  string;
  fr:    string;
  en:    string;
  alts:  string[]; // alternative keywords for fuzzy match
}

const SERVICE_SUGGESTIONS: ServiceSuggestion[] = [
  { slug: "hair",    fr: "Coiffure",       en: "Hair",       alts: ["coiffeur", "cheveux", "hairdresser"] },
  { slug: "braids",  fr: "Tresses",        en: "Braids",     alts: ["nattes", "box braids", "braiding"] },
  { slug: "nails",   fr: "Manucure",       en: "Nails",      alts: ["ongles", "manicure", "nail art"] },
  { slug: "massage", fr: "Massage",        en: "Massage",    alts: ["spa", "détente"] },
  { slug: "barber",  fr: "Barbier",        en: "Barber",     alts: ["barbe", "barbershop"] },
  { slug: "spa",     fr: "Spa",            en: "Spa",        alts: ["bien-être", "wellness"] },
  { slug: "beauty",  fr: "Soins",          en: "Beauty",     alts: ["facial", "esthétique"] },
  { slug: "makeup",  fr: "Maquillage",     en: "Makeup",     alts: ["make-up", "mua"] },
  { slug: "waxing",  fr: "Épilation",      en: "Waxing",     alts: ["cire", "hair removal"] },
  { slug: "eyelash", fr: "Cils",           en: "Eyelash",    alts: ["extensions cils", "lashes"] },
];

// ── ICONS (line-art, jamais d'emoji) ─────────────────────────

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7.5" />
      <path d="m20.5 20.5-4.4-4.4" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5c-3.6 0-6.5 2.9-6.5 6.5 0 4.5 6.5 12.5 6.5 12.5s6.5-8 6.5-12.5c0-3.6-2.9-6.5-6.5-6.5z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,.35)" strokeWidth="1.6" />
      <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ── COMPONENT ─────────────────────────────────────────────────

export default function SearchBar({
  lang,
  placeholder     = "Coiffure, massage, manucure…",
  cityPlaceholder = "Ville",
  buttonLabel     = "Chercher",
  defaultSearch   = "",
  defaultCity     = "",
  className       = "",
}: SearchBarProps) {
  const router                       = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search,    setSearch]       = useState(defaultSearch);
  const [city,      setCity]         = useState(defaultCity);
  const [citySuggestions,    setCitySuggestions]    = useState<string[]>([]);
  const [serviceSuggestions, setServiceSuggestions] = useState<ServiceSuggestion[]>([]);

  function handleCityInput(value: string) {
    setCity(value);
    if (value.length < 2) { setCitySuggestions([]); return; }
    const q = value.toLowerCase();
    setCitySuggestions(QUICK_CITIES.filter(c => c.toLowerCase().startsWith(q)).slice(0, 5));
  }

  // Predictive service filter — debounced via simple length gate (≥ 1 char).
  // Matches the start of FR/EN labels and any alt keyword.
  function handleServiceInput(value: string) {
    setSearch(value);
    if (value.length < 1) { setServiceSuggestions([]); return; }
    const q = value.toLowerCase();
    setServiceSuggestions(
      SERVICE_SUGGESTIONS.filter(s =>
        s.fr.toLowerCase().startsWith(q) ||
        s.en.toLowerCase().startsWith(q) ||
        s.alts.some(alt => alt.toLowerCase().startsWith(q))
      ).slice(0, 5),
    );
  }

  function handleSearch() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (city.trim())   params.set("city",   city.trim());
    const qs = params.toString();
    startTransition(() => {
      router.push(`/${lang}/salons${qs ? "?" + qs : ""}`);
    });
    setCitySuggestions([]);
    setServiceSuggestions([]);
  }

  // Pick a service suggestion → navigate immediately with category filter.
  function pickService(s: ServiceSuggestion) {
    const params = new URLSearchParams();
    params.set("cat", s.slug);
    if (city.trim()) params.set("city", city.trim());
    setSearch(lang === "fr" ? s.fr : s.en);
    setServiceSuggestions([]);
    startTransition(() => {
      router.push(`/${lang}/salons?${params.toString()}`);
    });
  }

  // Inputs : fond transparent forcé, aucune border, padding 0 (le label gère
  // le padding). Override les règles globales input { bg-card2; border:... }.
  // Focus glow géré par focus-within sur le conteneur parent.
  const inputClass = [
    "flex-1 w-full text-sm bg-transparent border-0 p-0",
    "focus:bg-transparent focus:border-0 focus:ring-0",
    "outline-none focus:outline-none focus-visible:outline-none",
    "font-body",
  ].join(" ");

  const inputStyle: React.CSSProperties = {
    color:           "var(--text)",
    // placeholder color via CSS variable trick — handled by inline class below
  };

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      <div
        className={[
          "flex flex-col sm:flex-row items-stretch sm:items-center",
          "bg-white/55 border border-white/45",
          "shadow-[0_8px_30px_rgba(36,28,24,.04)]",
          "focus-within:shadow-[0_0_0_4px_rgba(217,194,176,.18),0_8px_30px_rgba(36,28,24,.04)]",
          "transition-shadow duration-500 ease-out",
          "p-1.5",
        ].join(" ")}
        style={{
          backdropFilter:       "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderRadius:         32,
        }}
      >
        {/* ── Service ──────────────────────────────────────── */}
        <label
          className="relative flex items-center gap-3 flex-1 px-5 py-3 sm:py-3.5 cursor-text transition-colors duration-300 rounded-[26px] hover:bg-white/20"
          style={{ color: "var(--warm-mute)" }}
        >
          <SearchIcon />
          <input
            type="text"
            value={search}
            onChange={e => handleServiceInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            onFocus={() => { if (search.length >= 1) handleServiceInput(search); }}
            placeholder={placeholder}
            className={inputClass}
            style={inputStyle}
            aria-label={placeholder}
          />

          {/* Predictive service suggestions — soft opacity fade */}
          {serviceSuggestions.length > 0 && (
            <ul
              className="absolute top-full left-0 right-0 mt-3 overflow-hidden z-50"
              style={{
                backgroundColor:      "rgba(255,255,255,.85)",
                backdropFilter:       "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border:               "1px solid rgba(255,255,255,.5)",
                boxShadow:            "0 8px 30px rgba(36,28,24,.06)",
                borderRadius:         20,
                animation:            "fadeReveal 280ms cubic-bezier(0.22, 1, 0.36, 1) both",
              }}
            >
              {serviceSuggestions.map(s => (
                <li key={s.slug}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pickService(s); }}
                    className="w-full px-5 py-2.5 text-sm text-left transition-colors duration-300 hover:bg-white/40"
                    style={{
                      color:      "var(--text2)",
                      fontFamily: "var(--font-fraunces, var(--serif))",
                      fontWeight: 500,
                    }}
                  >
                    {lang === "fr" ? s.fr : s.en}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>

        {/* Hairline divider — desktop only, ultra subtil */}
        <div
          className="hidden sm:block self-stretch my-2"
          style={{ width: 1, background: "rgba(67,42,28,.08)" }}
          aria-hidden="true"
        />

        {/* ── Ville ────────────────────────────────────────── */}
        <label
          className="relative flex items-center gap-3 flex-1 px-5 py-3 sm:py-3.5 cursor-text transition-colors duration-300 rounded-[26px] hover:bg-white/20"
          style={{ color: "var(--warm-mute)" }}
        >
          <PinIcon />
          <input
            type="text"
            value={city}
            onChange={e => handleCityInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder={cityPlaceholder}
            className={inputClass}
            style={inputStyle}
            aria-label={cityPlaceholder}
          />

          {citySuggestions.length > 0 && (
            <ul
              className="absolute top-full left-0 right-0 mt-3 overflow-hidden z-50"
              style={{
                backgroundColor:      "rgba(255,255,255,.85)",
                backdropFilter:       "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border:               "1px solid rgba(255,255,255,.5)",
                boxShadow:            "0 8px 30px rgba(36,28,24,.06)",
                borderRadius:         20,
                animation:            "fadeReveal 280ms cubic-bezier(0.22, 1, 0.36, 1) both",
              }}
            >
              {citySuggestions.map(c => (
                <li key={c}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setCity(c); setCitySuggestions([]); }}
                    className="w-full px-5 py-2.5 text-sm text-left transition-colors duration-300 hover:bg-white/40"
                    style={{
                      color:      "var(--text2)",
                      fontFamily: "var(--font-fraunces, var(--serif))",
                      fontWeight: 500,
                    }}
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>

        {/* ── CTA — seul vert, intent.ts ──────────────────── */}
        <button
          type="button"
          onClick={handleSearch}
          disabled={isPending}
          className="shrink-0 px-6 py-3 sm:py-3.5 font-medium text-sm text-white transition-opacity duration-500"
          style={{
            backgroundColor: getIntentColor("cta"),
            borderRadius:    26,
            opacity:         isPending ? 0.7 : 0.95,
            margin:          "0",
            letterSpacing:   "0.01em",
          }}
        >
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner />
              {lang === "fr" ? "Recherche…" : "Searching…"}
            </span>
          ) : (
            buttonLabel
          )}
        </button>
      </div>
    </div>
  );
}
