"use client";

/**
 * ErrorState — affichage d'erreur actionnable.
 *
 * RÈGLES :
 * - Jamais d'erreur brute affichée à l'utilisateur
 * - Message actionnable selon le type
 * - Bouton retry toujours présent
 * - Logs côté infra uniquement — zéro console.error UI
 */

import { MotionTap } from "@/components/motion/MotionTap";
import { getIntentColor, getIntentBg } from "@/lib/design/intent";
import type { ErrorType } from "@/types";

const ERROR_CONFIG: Record<
  ErrorType,
  { icon: string; title: string; message: string; cta: string }
> = {
  network: {
    icon:    "📶",
    title:   "Connexion interrompue",
    message: "Vérifiez votre connexion et réessayez.",
    cta:     "Réessayer",
  },
  business: {
    icon:    "🗓",
    title:   "Créneau non disponible",
    message: "Ce créneau vient d'être pris. Choisissez un autre horaire.",
    cta:     "Voir les créneaux",
  },
  unknown: {
    icon:    "⚠️",
    title:   "Une erreur s'est produite",
    message: "Réessayez dans quelques secondes.",
    cta:     "Réessayer",
  },
};

interface ErrorStateProps {
  type:     ErrorType;
  onRetry:  () => void;
  className?: string;
}

export function ErrorState({ type, onRetry, className }: ErrorStateProps) {
  const cfg = ERROR_CONFIG[type];

  return (
    <div
      className={`flex flex-col items-center gap-3 p-6 text-center ${className ?? ""}`}
      role="alert"
      aria-live="assertive"
    >
      <span className="text-3xl" aria-hidden="true">{cfg.icon}</span>

      <div>
        <p className="font-semibold text-sm text-text">{cfg.title}</p>
        <p className="text-xs text-text3 mt-1">{cfg.message}</p>
      </div>

      <MotionTap
        onClick={onRetry}
        className="px-5 py-2 rounded-xl text-xs font-semibold"
        style={{
          color:           getIntentColor("cta"),
          backgroundColor: getIntentBg("cta"),
        }}
      >
        {cfg.cta}
      </MotionTap>
    </div>
  );
}
