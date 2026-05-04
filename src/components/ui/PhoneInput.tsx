"use client";

import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from "react";
import { COUNTRIES, toE164, isValidLocalNumber, detectDefaultCountry, type Country } from "@/lib/phone";

// ── Backward-compat exports ───────────────────────────────────

export { COUNTRIES, toE164 as buildFullPhone };
export type { Country };

export function splitPhone(full: string): { countryCode: string; local: string } {
  const digits = full.replace(/^\+/, "");
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (digits.startsWith(c.dial)) return { countryCode: c.dial, local: digits.slice(c.dial.length) };
  }
  return { countryCode: "221", local: digits };
}

// ── Types ─────────────────────────────────────────────────────

interface PhoneInputProps {
  countryISO?:     string;
  localNumber:     string;
  onCountryChange: (country: Country) => void;
  onNumberChange:  (local: string) => void;
  onEnter?:        () => void;
  onValidChange?:  (e164: string | null) => void;
  placeholder?:    string;
  autoFocus?:      boolean;
  className?:      string;
  disabled?:       boolean;
}

// ── Component ─────────────────────────────────────────────────

export function PhoneInput({
  countryISO,
  localNumber,
  onCountryChange,
  onNumberChange,
  onEnter,
  onValidChange,
  placeholder,
  autoFocus,
  className = "",
  disabled,
}: PhoneInputProps) {
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState("");
  const [touched, setTouched] = useState(false);
  const dropdownRef           = useRef<HTMLDivElement>(null);
  const searchRef             = useRef<HTMLInputElement>(null);
  const triggerId             = useRef(`phone-trigger-${Math.random().toString(36).slice(2)}`);
  const listboxId             = useRef(`phone-listbox-${Math.random().toString(36).slice(2)}`);

  const country = countryISO
    ? (COUNTRIES.find(c => c.iso === countryISO) ?? COUNTRIES[0])
    : detectDefaultCountry();

  const isValid  = isValidLocalNumber(localNumber, country);
  const showErr  = touched && localNumber.length > 0 && !isValid;

  useEffect(() => {
    onValidChange?.(isValid ? toE164(country.dial, localNumber) : null);
  }, [localNumber, country, isValid, onValidChange]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false); setSearch("");
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  // Strip leading + from search so "+352" matches dial "352"
  const dialSearch = search.replace(/^\+/, "");
  const filtered = COUNTRIES.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.nameFr.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(dialSearch) ||
    c.iso.toLowerCase().includes(search.toLowerCase())
  );

  function selectCountry(c: Country) {
    onCountryChange(c);
    setOpen(false);
    setSearch("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter")  onEnter?.();
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>

      {/* ── Input row ─────────────────────────────────────────── */}
      <div className={`
        flex items-stretch bg-card border rounded-2xl overflow-hidden transition-all duration-150
        ${open      ? "border-g2/50 ring-2 ring-g2/20" : "border-border2"}
        ${showErr   ? "border-red/50 ring-2 ring-red/10" : ""}
        ${disabled  ? "opacity-50 pointer-events-none"  : ""}
      `}>

        {/* Country trigger */}
        <button
          id={triggerId.current}
          type="button"
          disabled={disabled}
          onClick={() => setOpen(v => !v)}
          aria-haspopup="listbox"
          aria-controls={listboxId.current}
          aria-label={`Pays sélectionné : ${country.nameFr} +${country.dial}. Cliquer pour changer.`}
          className="
            flex items-center gap-2 px-4 py-4 min-w-[84px] shrink-0
            bg-card2/50 border-r border-border2
            hover:bg-card2 active:scale-95
            transition-all duration-100 cursor-pointer select-none
          "
        >
          <span className="text-xl leading-none" aria-hidden="true">{country.flag}</span>
          <span className="text-sm font-semibold text-text2">+{country.dial}</span>
          <svg
            className={`w-3 h-3 text-text3 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {/* Phone number input */}
        <input
          type="tel"
          inputMode="tel"
          value={localNumber}
          onChange={e => onNumberChange(e.target.value.replace(/[^\d\s\-()+]/g, ""))}
          onKeyDown={handleKey}
          onBlur={() => setTouched(true)}
          placeholder={placeholder ?? country.example ?? "Numéro"}
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="tel-national"
          aria-label="Numéro de téléphone"
          aria-invalid={showErr ? "true" : "false"}
          aria-describedby={showErr ? "phone-error" : undefined}
          className="flex-1 px-4 py-4 bg-transparent outline-none text-base text-text placeholder:text-text3 font-sans min-w-0"
        />

        {/* Validity indicator */}
        {touched && localNumber.length > 0 && (
          <span aria-hidden="true" className="flex items-center pr-4 text-sm">
            {isValid ? <span className="text-g2">✓</span> : <span className="text-red">✗</span>}
          </span>
        )}
      </div>

      {showErr && (
        <p id="phone-error" role="alert" className="mt-1 text-xs text-red pl-1">
          Numéro invalide pour {country.nameFr}
        </p>
      )}

      {/* ── Dropdown ──────────────────────────────────────────── */}
      {open && (
        <div
          className="
            absolute top-full left-0 z-[999] mt-1
            w-full min-w-[300px] max-w-[380px]
            bg-card border border-border2 rounded-2xl shadow-card overflow-hidden
          "
        >
          {/* Search */}
          <div className="p-3 border-b border-border">
            <label htmlFor="phone-search" className="sr-only">Rechercher un pays</label>
            <div className="flex items-center gap-2 bg-card2 rounded-xl px-3 py-2">
              <svg aria-hidden="true" className="w-4 h-4 text-text3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                id="phone-search"
                ref={searchRef}
                type="text"
                title="Rechercher un pays par nom ou indicatif"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Escape") { setOpen(false); setSearch(""); }
                  if (e.key === "Enter" && filtered.length === 1) selectCountry(filtered[0]);
                }}
                placeholder="Rechercher… ex: Lux, +352"
                autoComplete="off"
                className="flex-1 bg-transparent outline-none text-sm text-text placeholder:text-text3"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Effacer la recherche" className="text-text3 hover:text-text text-xs p-0.5">✕</button>
              )}
            </div>
          </div>

          {/* Options — using role="listbox" + role="option" on each clickable row */}
          <ul
            id={listboxId.current}
            role="listbox"
            aria-label="Choisissez un pays"
            aria-activedescendant={country.iso}
            className="max-h-60 overflow-y-auto overscroll-contain"
          >
            {filtered.length === 0 ? (
              <li role="presentation" className="px-4 py-3 text-sm text-text3 text-center">
                Aucun résultat pour «&nbsp;{search}&nbsp;»
              </li>
            ) : (
              filtered.map(c => {
                const selected = c.iso === country.iso;
                return (
                  <li
                    key={c.iso}
                    id={c.iso}
                    role="option"
                    aria-selected={selected}
                    tabIndex={0}
                    onClick={() => selectCountry(c)}
                    onKeyDown={e => (e.key === "Enter" || e.key === " ") && selectCountry(c)}
                    className={`
                      flex items-center gap-3 px-4 py-3 cursor-pointer
                      text-sm transition-colors duration-75 outline-none
                      hover:bg-card2 focus:bg-card2 active:bg-g2/10
                      ${selected ? "bg-g2/5 text-g2 font-semibold" : "text-text2"}
                    `}
                  >
                    <span aria-hidden="true" className="text-xl w-7 text-center leading-none">{c.flag}</span>
                    <span className="flex-1 min-w-0 truncate">{c.nameFr}</span>
                    <span className="text-text3 text-xs font-mono shrink-0 tabular-nums">+{c.dial}</span>
                    {selected && <span aria-hidden="true" className="text-g2 text-xs ml-1">✓</span>}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
