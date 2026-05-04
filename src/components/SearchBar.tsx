"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SupportedLang } from "@/lib/i18n-server";

interface SearchBarProps {
  lang:           SupportedLang;
  placeholder?:   string;
  cityPlaceholder?:string;
  buttonLabel?:   string;
  defaultSearch?: string;
  defaultCity?:   string;
  className?:     string;
}

const QUICK_CITIES: string[] = [
  "Dakar", "Abidjan", "Casablanca", "Paris", "Bruxelles", "Luxembourg",
  "Thiès", "Bamako", "Rabat", "Lyon", "London",
];

export default function SearchBar({
  lang,
  placeholder    = "Coiffure, massage, manucure…",
  cityPlaceholder = "Ville",
  buttonLabel    = "Chercher",
  defaultSearch  = "",
  defaultCity    = "",
  className      = "",
}: SearchBarProps) {
  const router                    = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch]       = useState(defaultSearch);
  const [city,   setCity]         = useState(defaultCity);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);

  function handleCityInput(value: string) {
    setCity(value);
    if (value.length < 2) { setCitySuggestions([]); return; }
    const q = value.toLowerCase();
    setCitySuggestions(QUICK_CITIES.filter(c => c.toLowerCase().startsWith(q)).slice(0, 5));
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
  }

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      <div className="flex flex-col sm:flex-row gap-2 bg-card rounded-2xl shadow-card p-2 border border-border">

        {/* Service input */}
        <div className="flex items-center gap-2 flex-1 px-3 py-1">
          <svg className="w-4 h-4 text-text3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-sm text-text placeholder:text-text3 font-sans"
          />
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px bg-border2 self-stretch my-1" />

        {/* City input with suggestions */}
        <div className="relative flex items-center gap-2 flex-1 px-3 py-1">
          <svg className="w-4 h-4 text-text3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx={12} cy={9} r={2.5} />
          </svg>
          <input
            type="text"
            value={city}
            onChange={e => handleCityInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder={cityPlaceholder}
            className="flex-1 bg-transparent outline-none text-sm text-text placeholder:text-text3 font-sans"
          />

          {citySuggestions.length > 0 && (
            <ul className="absolute top-full left-0 right-0 mt-2 bg-card border border-border2 rounded-xl shadow-card z-50 overflow-hidden">
              {citySuggestions.map(c => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => { setCity(c); setCitySuggestions([]); }}
                    className="w-full px-4 py-2.5 text-sm text-text2 text-left hover:bg-card2 transition-colors"
                  >
                    📍 {c}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Search button */}
        <button
          type="button"
          onClick={handleSearch}
          disabled={isPending}
          className="
            shrink-0 px-6 py-2.5 rounded-xl font-semibold text-sm text-white
            bg-g1 hover:bg-g3 transition-colors duration-200
            disabled:opacity-60 disabled:cursor-not-allowed
            shadow-green
          "
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {lang === "fr" ? "Recherche…" : "Searching…"}
            </span>
          ) : buttonLabel}
        </button>
      </div>
    </div>
  );
}
