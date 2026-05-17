/**
 * Image rights registry — copyright tracking for every visual asset
 * used in Belo's UI, marketing, and SEO pages.
 *
 * RULES :
 * - No image goes into production without an entry here.
 * - User-uploaded salon photos are EXCLUDED — they live on R2 and
 *   carry their tenant ownership (see TenantPhoto in Prisma).
 * - All Belo-curated stock and editorial photography is logged here.
 *
 * RFC : license types per major stock platforms.
 */

export type LicenseType =
  | "owned"           // Shot by Belo directly — perpetual rights
  | "commercial"      // Paid commercial license — full rights
  | "royalty-free"    // RF — perpetual non-exclusive
  | "creative-commons"// CC — requires attribution per variant
  | "editorial-only"  // Editorial use only, NOT commercial
  | "rights-managed"; // Limited duration / territory

export type ImageSource =
  | "belo-studio"     // Shot by Belo
  | "salon-uploaded"  // Salon owner uploaded — see TenantPhoto
  | "unsplash"        // unsplash.com
  | "pexels"          // pexels.com
  | "shutterstock"
  | "adobe-stock"
  | "istock"
  | "other";

export interface ImageRight {
  /** Unique ID — usually the asset filename. */
  id:                string;
  /** Where the image came from. */
  source:            ImageSource;
  /** License granted to Belo. */
  license:           LicenseType;
  /** Attribution string required (creative-commons, some royalty-free). */
  attribution?:      string;
  /** URL to the original asset or license proof. */
  sourceUrl?:        string;
  /** ISO date when the license expires (rights-managed only). */
  expiresAt?:        string;
  /** Free-form notes — territory restrictions, model release, etc. */
  notes?:            string;
  /** Photographer/creator name when required. */
  creator?:          string;
  /** Where the asset is currently used in the codebase. */
  usedIn?:           string[];
}

// ── REGISTRY ─────────────────────────────────────────────────
// Add every Belo-curated visual asset here before deploying.
// Salon-uploaded photos are NOT included — they are managed per
// tenant via Prisma + Cloudflare R2 (see Tenant.photos[]).

export const IMAGE_REGISTRY: ImageRight[] = [
  {
    id:         "belo-logo-wordmark",
    source:     "belo-studio",
    license:    "owned",
    notes:      "Wordmark — Fraunces 600 + custom kerning. Belo brand asset.",
    usedIn:     ["Nav.tsx", "footer", "favicon"],
  },
  // Example entries — replace with actual assets as they are added :
  // {
  //   id:           "hero-skincare-morning-light.jpg",
  //   source:       "unsplash",
  //   license:      "royalty-free",
  //   attribution:  "Photo by [Name] on Unsplash",
  //   sourceUrl:    "https://unsplash.com/photos/...",
  //   creator:      "Photographer Name",
  //   usedIn:       ["src/app/[lang]/page.tsx hero"],
  // },
];

// ── HELPERS ───────────────────────────────────────────────────

export function findImageRight(id: string): ImageRight | undefined {
  return IMAGE_REGISTRY.find(r => r.id === id);
}

/** Returns assets requiring visible attribution in the UI. */
export function getAttributionList(): ImageRight[] {
  return IMAGE_REGISTRY.filter(r => r.attribution);
}

/** Returns assets whose license has expired. Run periodically. */
export function getExpiredAssets(now = new Date()): ImageRight[] {
  return IMAGE_REGISTRY.filter(r => {
    if (!r.expiresAt) return false;
    return new Date(r.expiresAt).getTime() < now.getTime();
  });
}
