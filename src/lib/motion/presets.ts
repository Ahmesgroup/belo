/**
 * BELO MOTION PRESETS
 * Composables Framer Motion pré-validés.
 * Importer ces presets — ne jamais définir de Variants inline.
 */

import type { Variants, TargetAndTransition, Transition } from "framer-motion";
import { MOTION } from "./motion";

const BASE_TRANSITION: Transition = {
  duration: MOTION.duration.micro,
  ease:     MOTION.easing,
};

const UI_TRANSITION: Transition = {
  duration: MOTION.duration.ui,
  ease:     MOTION.easing,
};

const LAYOUT_TRANSITION: Transition = {
  duration: MOTION.duration.layout,
  ease:     MOTION.easing,
};

// ── TAP FEEDBACK ──────────────────────────────────────────────
// whileTap prop — appliqué à tout élément interactif

export const tap: TargetAndTransition = {
  scale:      MOTION.scale.tap,
  transition: BASE_TRANSITION,
};

// ── PRESS STATE ───────────────────────────────────────────────
// Élément maintenu pressé (ex. long press)

export const press: TargetAndTransition = {
  scale:      MOTION.scale.press,
  transition: BASE_TRANSITION,
};

// ── FADE IN ───────────────────────────────────────────────────
// Entrée simple par opacité

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: UI_TRANSITION,
  },
};

// ── SLIDE UP ──────────────────────────────────────────────────
// Entrée depuis le bas — pour cards, modals, bottom sheets

export const slideUp: Variants = {
  hidden:  { opacity: 0, y: MOTION.translate.enterY },
  visible: {
    opacity: 1,
    y: 0,
    transition: LAYOUT_TRANSITION,
  },
  exit: {
    opacity: 0,
    y: MOTION.translate.exitY,
    transition: UI_TRANSITION,
  },
};

// ── STAGGER CONTAINER ─────────────────────────────────────────
// Appliqué au parent d'une liste animée

export const staggerContainer: Variants = {
  hidden:  {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

// ── STAGGER ITEM ──────────────────────────────────────────────
// Appliqué à chaque enfant du staggerContainer

export const staggerItem: Variants = {
  hidden:  {
    opacity: 0,
    y: MOTION.translate.enterY,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: LAYOUT_TRANSITION,
  },
};

// ── CTA FEEDBACK ──────────────────────────────────────────────
// Bouton CTA — tap + légère décélération

export const ctaFeedback: TargetAndTransition = {
  scale:      MOTION.scale.tap,
  transition: { ...BASE_TRANSITION, type: "spring", stiffness: 400, damping: 17 },
};
