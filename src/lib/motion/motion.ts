/**
 * BELO MOTION SYSTEM
 * @frozen — Ne pas modifier sans validation équipe
 *
 * RÈGLE : Si l'utilisateur remarque l'effet → trop fort.
 * Motion = feedback invisible, pas décoration.
 *
 * Une seule courbe easing dans tout le projet.
 * Toute animation hors de ce fichier = erreur ESLint.
 */

export const MOTION = {
  /** Spring-like easing — Apple DNA. Seule courbe autorisée. */
  easing: [0.22, 1, 0.36, 1] as const,

  duration: {
    micro:  0.15, // tap feedback — imperceptible mais ressenti
    ui:     0.22, // transitions UI standard
    layout: 0.3,  // shared elements, layout animations
  },

  scale: {
    tap:   0.96, // feedback clic
    press: 0.98, // état "pressé" maintenu
  },

  translate: {
    enterY: 12, // px — entrée depuis le bas
    exitY:  -8, // px — sortie vers le haut
  },
} as const;

export type MotionEasing = typeof MOTION.easing;
