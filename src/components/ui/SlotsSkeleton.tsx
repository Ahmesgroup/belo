"use client";

/**
 * SlotsSkeleton — skeleton pour la grille de créneaux.
 *
 * count = expectedSlotCount depuis l'API → zéro CLS.
 * Défaut 6 si non fourni (3 colonnes × 2 lignes).
 * Jamais de count arbitraire hardcodé dans les composants.
 */

interface SlotsSkeleton {
  count?: number;
}

export function SlotsSkeleton({ count = 6 }: SlotsSkeleton) {
  return (
    <div className="grid grid-cols-3 gap-2" role="status" aria-label="Chargement des créneaux">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="h-10 rounded-xl bg-card2 animate-pulse"
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">Chargement des créneaux disponibles…</span>
    </div>
  );
}
