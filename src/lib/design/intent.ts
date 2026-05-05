/**
 * BELO INTENT SYSTEM
 * @frozen — Ne pas modifier sans validation équipe
 *
 * RÈGLE ABSOLUE :
 * Le vert #1DB954 n'existe QUE sous ces intentions.
 * Jamais en décoration, promo, ou info neutre.
 */

export type PositiveIntent = "cta" | "success" | "confirm";
export type NeutralIntent  = "neutral" | "muted";
export type DangerIntent   = "error";
export type Intent         = PositiveIntent | NeutralIntent | DangerIntent;

export const INTENT_COLORS: Record<Intent, string> = {
  cta:     "#1DB954",
  success: "#1DB954",
  confirm: "#1DB954",
  neutral: "#0A0A0A",
  muted:   "#6B7280",
  error:   "#DC2626",
} as const;

export function getIntentColor(intent: Intent): string {
  return INTENT_COLORS[intent];
}

/** Background tint at 10% opacity — for subtle intent surfaces. */
export function getIntentBg(intent: Intent): string {
  const map: Record<Intent, string> = {
    cta:     "rgba(29,185,84,.10)",
    success: "rgba(29,185,84,.10)",
    confirm: "rgba(29,185,84,.10)",
    neutral: "rgba(10,10,10,.06)",
    muted:   "rgba(107,114,128,.08)",
    error:   "rgba(220,38,38,.08)",
  };
  return map[intent];
}
