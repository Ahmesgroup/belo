/**
 * @frozen — Photography Direction System
 *
 * Photography is now the #1 emotional layer of Belo.
 * Every image displayed (hero, salon card, SEO page, banner) MUST
 * pass these rules before being added to the registry.
 *
 * "If the photo would feel out of place in Aesop / Rhode / Vogue Beauty,
 *  it does not belong on Belo."
 *
 * Pair this file with src/lib/legal/imageRights.ts for license tracking.
 */

import type { Market } from "@/lib/market/theme";

// ── COLOR TEMPERATURE ────────────────────────────────────────

/**
 * Target color temperature range in Kelvin.
 * Warmer = lower K. Belo runs cinematic warm.
 */
export const COLOR_TEMP = {
  africa: { min: 3200, max: 4200, ideal: 3800 },  // golden hour, candlelight skin
  europe: { min: 4200, max: 5400, ideal: 4800 },  // soft daylight, north window
} as const;

// ── PHOTO RULES PER MARKET ───────────────────────────────────

export type PhotoSubject =
  | "skin"
  | "hands"
  | "hair-natural"
  | "braids"
  | "fabric"
  | "ritual"
  | "ambient"
  | "salon-interior"
  | "product-detail"
  | "portrait";

export interface PhotoRules {
  /** Required emotional qualities — every approved photo has these. */
  must: string[];
  /** Disqualifying qualities — single occurrence = reject. */
  forbidden: string[];
  /** Preferred subjects. */
  subjects: PhotoSubject[];
  /** Lighting direction. */
  lighting: "golden-natural" | "soft-daylight";
  /** Acceptable color temperature range (K). */
  temperatureRange: readonly [number, number];
  /** Maximum saturation (0–1) — beauty editorial stays restrained. */
  maxSaturation: number;
  /** Maximum contrast (0–1) — soft shadows only. */
  maxContrast: number;
  /** Required depth — beauty editorial breathes. */
  depthOfField: "shallow" | "medium" | "deep";
}

export const AFRICA_RULES: PhotoRules = {
  must: [
    "warm skin light",
    "human closeness",
    "tactile realism",
    "premium grade",
    "emotional warmth",
    "natural texture",
    "ambient cinematic light",
  ],
  forbidden: [
    "clichés tribal patterns",
    "stereotypes",
    "oversaturated colors",
    "fake african aesthetic",
    "stock startup teams",
    "hard studio strobes",
    "HDR processing",
  ],
  subjects:         ["skin", "hands", "hair-natural", "braids", "fabric", "ritual", "ambient"],
  lighting:         "golden-natural",
  temperatureRange: [COLOR_TEMP.africa.min, COLOR_TEMP.africa.max],
  maxSaturation:    0.85,
  maxContrast:      0.65,
  depthOfField:     "shallow",
};

export const EUROPE_RULES: PhotoRules = {
  must: [
    "calm framing",
    "wellness atmosphere",
    "natural daylight",
    "slow beauty",
    "elegant silence",
    "editorial softness",
    "tonal coherence",
  ],
  forbidden: [
    "cold stock imagery",
    "fake smiling startup teams",
    "overexposed",
    "aggressive contrast",
    "neon / saturated accents",
    "blue corporate tint",
    "phone-camera flash",
  ],
  subjects:         ["skin", "product-detail", "ritual", "ambient", "salon-interior"],
  lighting:         "soft-daylight",
  temperatureRange: [COLOR_TEMP.europe.min, COLOR_TEMP.europe.max],
  maxSaturation:    0.75,
  maxContrast:      0.55,
  depthOfField:     "medium",
};

export const PHOTO_RULES_BY_MARKET: Record<Market, PhotoRules> = {
  africa: AFRICA_RULES,
  europe: EUROPE_RULES,
};

// ── GLOBAL RULES (apply to BOTH markets) ─────────────────────

/** Required for every Belo photo, regardless of market. */
export const GLOBAL_MUST: readonly string[] = [
  "coherent color temperature with surrounding photos in the same page",
  "coherent texture grain",
  "coherent emotional tone",
  "cinematic warmth",
  "tactile realism",
  "no visible logo / brand mark (unless Belo itself)",
  "subject consent + model release on file (humans)",
  "license recorded in imageRights.ts before deploy",
];

/** Auto-disqualifies any photo from production. */
export const GLOBAL_FORBIDDEN: readonly string[] = [
  "watermarks",
  "AI-generated humans without disclosure",
  "duplicate of another platform's hero image",
  "rights expired (see imageRights.ts expiresAt)",
  "filtered with Instagram beauty 2017 presets",
];

// ── HELPER ───────────────────────────────────────────────────

export function getPhotoRules(market: Market): PhotoRules {
  return PHOTO_RULES_BY_MARKET[market];
}
