/**
 * @frozen — Cultural Atmosphere Layer
 *
 * BELO operates across two markets with one design DNA :
 *   AFRICA — Senegal first (Dakar primary launch)
 *   EUROPE — France, Belgium, Luxembourg, Switzerland
 *
 * The booking flow, motion system, typography, components,
 * accessibility, performance, and SEO architecture are GLOBALLY
 * IDENTICAL. Only the emotional temperature shifts.
 *
 * "One platform. One emotional DNA. Multiple cultural atmospheres."
 */

export type Market = "africa" | "europe";

export interface MarketTheme {
  /** Multiplier on ambient glow opacity (1.0 = base). Africa is warmer. */
  warmth:        number;
  /** Density factor for spacing and grouping. Africa slightly denser. */
  density:       number;
  /** Direct glow opacity override on hero ambient lights. */
  glowOpacity:   number;
  /** Photography direction — affects image filter + content selection. */
  imageStyle:    "human" | "editorial";
  /** Motion tempo — affects ambient breath durations. */
  motionStyle:   "alive" | "calm";
  /** Copy tone — affects headlines and CTAs. */
  copyTone:      "direct" | "editorial";
  /** Trust strategy — affects social proof emphasis. */
  socialProof:   "community" | "minimal";
  /** Primary trust channel — WhatsApp in Africa, reviews in Europe. */
  trustChannel:  "whatsapp" | "reviews";
}

// ── THEMES ────────────────────────────────────────────────────

export const AFRICA_THEME: MarketTheme = {
  warmth:       1.15,
  density:      1.05,
  glowOpacity:  0.42,
  imageStyle:   "human",
  motionStyle:  "alive",
  copyTone:     "direct",
  socialProof:  "community",
  trustChannel: "whatsapp",
};

export const EUROPE_THEME: MarketTheme = {
  warmth:       0.9,
  density:      1.0,
  glowOpacity:  0.28,
  imageStyle:   "editorial",
  motionStyle:  "calm",
  copyTone:     "editorial",
  socialProof:  "minimal",
  trustChannel: "reviews",
};

export const MARKET_THEMES: Record<Market, MarketTheme> = {
  africa: AFRICA_THEME,
  europe: EUROPE_THEME,
} as const;

export function getMarketTheme(market: Market): MarketTheme {
  return MARKET_THEMES[market];
}
