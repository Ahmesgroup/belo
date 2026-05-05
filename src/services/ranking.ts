/**
 * src/services/ranking.ts — Scoring salon côté client.
 *
 * Logique métier pure : zéro fetch, zéro state.
 * Appelé par les composants via un prop calculé DANS le parent,
 * jamais inline dans un composant de présentation.
 *
 * RÈGLE : 0 ou 1 highlight par liste. Jamais 2+.
 */

import type { Salon } from "@/types";

/**
 * Perception de distance non-linéaire.
 * 0 km → score 1.0  |  1 km → 0.5  |  5 km → 0.17
 * Rend les salons proches nettement plus attractifs.
 */
function distanceScore(km: number): number {
  return 1 / (1 + km);
}

function buildScore(salon: Salon): number {
  return salon.rating * 0.6 + distanceScore(salon.distanceKm) * 0.4;
}

/**
 * Retourne l'id du meilleur salon disponible dans la liste.
 * "Disponible" = remainingSlots > 0.
 * Retourne null si aucun salon avec créneaux.
 */
export function getBestSalonId(salons: Salon[]): string | null {
  return (
    salons
      .filter((s) => s.remainingSlots > 0)
      .sort((a, b) => buildScore(b) - buildScore(a))[0]?.id ?? null
  );
}
