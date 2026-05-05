/**
 * BELO FONTS
 * Fraunces — headings (weight 600, 700 uniquement)
 * DM_Sans  — body copy (400, 500, 600)
 *
 * display: "swap" → critique LCP + SEO
 * Pas de weight 400 sur Fraunces — réservé aux headings bold uniquement.
 */

import { Fraunces, DM_Sans } from "next/font/google";

export const fraunces = Fraunces({
  subsets:  ["latin"],
  weight:   ["600", "700"],
  display:  "swap",
  variable: "--font-fraunces",
});

export const dmSans = DM_Sans({
  subsets:  ["latin"],
  weight:   ["400", "500", "600"],
  display:  "swap",
  variable: "--font-dm",
});
