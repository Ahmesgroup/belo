"use client";

import { type ChangeEvent } from "react";

// ── Country list ──────────────────────────────────────────────

export const COUNTRIES = [
  { code: "221", flag: "🇸🇳", name: "Sénégal" },
  { code: "225", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { code: "223", flag: "🇲🇱", name: "Mali" },
  { code: "224", flag: "🇬🇳", name: "Guinée" },
  { code: "220", flag: "🇬🇲", name: "Gambie" },
  { code: "212", flag: "🇲🇦", name: "Maroc" },
  { code: "216", flag: "🇹🇳", name: "Tunisie" },
  { code: "33",  flag: "🇫🇷", name: "France" },
  { code: "32",  flag: "🇧🇪", name: "Belgique" },
  { code: "1",   flag: "🇺🇸", name: "USA" },
  { code: "44",  flag: "🇬🇧", name: "UK" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

// ── Helpers ───────────────────────────────────────────────────

/** Build a full E.164 number from its parts. */
export function buildFullPhone(countryCode: string, localNumber: string): string {
  return `+${countryCode}${localNumber.replace(/\s/g, "")}`;
}

/**
 * Split a saved E.164 number back into { countryCode, local }.
 * Falls back to Senegal (+221) when the prefix is unrecognised.
 */
export function splitPhone(full: string): { countryCode: string; local: string } {
  // Try longest prefix first to avoid "1" matching "+221"
  const sorted = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (full.startsWith("+" + c.code)) {
      return { countryCode: c.code, local: full.slice(c.code.length + 1) };
    }
  }
  return { countryCode: "221", local: full.replace(/^\+\d{1,4}/, "") };
}

// ── Component ─────────────────────────────────────────────────

interface PhoneInputProps {
  countryCode: string;
  localNumber: string;
  onCountryChange: (code: string) => void;
  onNumberChange: (number: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  fontSize?: number;
  autoFocus?: boolean;
}

export function PhoneInput({
  countryCode,
  localNumber,
  onCountryChange,
  onNumberChange,
  onEnter,
  placeholder,
  fontSize = 14,
  autoFocus,
}: PhoneInputProps) {
  const defaultPlaceholder = countryCode === "221" ? "77 123 45 67" : "6 12 34 56 78";

  return (
    <div style={{ display: "flex", border: "1px solid var(--border2)", borderRadius: 12, overflow: "hidden" }}>
      {/* Country code selector */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <select
          title="Indicatif pays"
          value={countryCode}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onCountryChange(e.target.value)}
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            padding: "10px 28px 10px 10px",
            background: "rgba(255,255,255,.04)",
            border: "none",
            borderRight: "1px solid var(--border2)",
            color: "var(--text2)",
            fontSize: 13,
            cursor: "pointer",
            outline: "none",
          }}
        >
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>
              {c.flag} +{c.code}
            </option>
          ))}
        </select>
        <span style={{
          position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)",
          fontSize: 9, color: "var(--text3)", pointerEvents: "none",
        }}>▾</span>
      </div>

      {/* Local number */}
      <input
        type="tel"
        value={localNumber}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onNumberChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onEnter?.()}
        placeholder={placeholder ?? defaultPlaceholder}
        autoFocus={autoFocus}
        style={{
          flex: 1, border: "none", borderRadius: 0,
          padding: "10px 14px", fontSize, background: "transparent", color: "var(--text)",
        }}
      />
    </div>
  );
}
