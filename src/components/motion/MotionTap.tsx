"use client";

/**
 * MotionTap — wrapper universel pour tout élément tappable.
 * RÈGLE : Tout élément cliquable DOIT passer par MotionTap.
 * Garantit un tap feedback < 100ms cohérent dans toute l'app.
 */

import { motion } from "framer-motion";
import { tap } from "@/lib/motion/presets";
import type { ReactNode, MouseEventHandler } from "react";

interface MotionTapProps {
  children:   ReactNode;
  onClick?:   MouseEventHandler<HTMLDivElement>;
  className?: string;
  style?:     React.CSSProperties;
  disabled?:  boolean;
  /** Rôle ARIA pour l'accessibilité */
  role?:      string;
  /** aria-label pour les éléments sans texte visible */
  ariaLabel?: string;
}

export function MotionTap({
  children,
  onClick,
  className,
  style,
  disabled = false,
  role,
  ariaLabel,
}: MotionTapProps) {
  return (
    <motion.div
      whileTap={disabled ? undefined : tap}
      onClick={disabled ? undefined : onClick}
      className={className}
      role={role}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      style={{ cursor: disabled ? "default" : "pointer", ...style }}
    >
      {children}
    </motion.div>
  );
}
