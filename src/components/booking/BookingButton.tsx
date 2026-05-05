"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ctaFeedback, fadeIn } from "@/lib/motion/presets";
import { MOTION } from "@/lib/motion/motion";
import { getIntentColor } from "@/lib/design/intent";
import type { AsyncStatus } from "@/hooks/useAsyncAction";

interface BookingButtonProps {
  status:   AsyncStatus;
  onClick:  () => void;
  disabled?: boolean;
  fullWidth?: boolean;
}

const LABELS: Record<AsyncStatus, string> = {
  idle:    "Réserver",
  loading: "Réservation...",
  success: "Confirmé ✓",
  error:   "Réessayer",
};

const BG_COLORS: Record<AsyncStatus, string> = {
  idle:    getIntentColor("cta"),
  loading: getIntentColor("muted"),
  success: getIntentColor("success"),
  error:   getIntentColor("error"),
};

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="8" cy="8" r="6"
        stroke="rgba(255,255,255,.35)"
        strokeWidth="2"
      />
      <path
        d="M8 2a6 6 0 016 6"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BookingButton({
  status,
  onClick,
  disabled = false,
  fullWidth = false,
}: BookingButtonProps) {
  const isLoading = status === "loading";
  const isDisabled = disabled || isLoading;

  return (
    <motion.button
      whileTap={isDisabled ? undefined : ctaFeedback}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      aria-busy={isLoading}
      aria-live="polite"
      className={[
        "relative inline-flex items-center justify-center gap-2",
        "py-4 px-6 rounded-2xl font-bold text-white text-base",
        "select-none outline-none",
        "transition-colors duration-150",
        fullWidth ? "w-full" : "",
        isDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
      ].filter(Boolean).join(" ")}
      style={{
        backgroundColor: BG_COLORS[status],
        // RÈGLE : jamais de succès visuel avant confirmation DB
        // Le changement de couleur ne se produit qu'après retour API
      }}
      animate={{
        backgroundColor: BG_COLORS[status],
        transition: {
          duration: MOTION.duration.ui,
          ease:     MOTION.easing,
        },
      }}
    >
      {isLoading && <Spinner />}

      <AnimatePresence mode="wait">
        <motion.span
          key={status}
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0, transition: { duration: MOTION.duration.micro } }}
        >
          {LABELS[status]}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
