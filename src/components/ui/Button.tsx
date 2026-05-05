"use client";

import { motion } from "framer-motion";
import { ctaFeedback } from "@/lib/motion/presets";
import { getIntentColor, getIntentBg } from "@/lib/design/intent";
import type { ReactNode, MouseEventHandler } from "react";

interface ButtonProps {
  intent:    "cta" | "confirm";
  children:  ReactNode;
  onClick?:  MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?:     "button" | "submit" | "reset";
  fullWidth?: boolean;
  size?:     "sm" | "md" | "lg";
  variant?:  "filled" | "ghost";
}

const SIZES = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-sm font-semibold",
  lg: "px-8 py-4 text-base font-bold",
} as const;

export function Button({
  intent,
  children,
  onClick,
  disabled = false,
  type = "button",
  fullWidth = false,
  size = "md",
  variant = "filled",
}: ButtonProps) {
  const color = getIntentColor(intent);
  const bg    = getIntentBg(intent);

  const filledStyle = {
    backgroundColor: disabled ? "#E5E7EB" : color,
    color:           disabled ? "#9CA3AF" : "#ffffff",
    border:          "none",
  };

  const ghostStyle = {
    backgroundColor: disabled ? "transparent" : bg,
    color:           disabled ? "#9CA3AF"      : color,
    border:          `1.5px solid ${disabled ? "#E5E7EB" : color}`,
  };

  return (
    <motion.button
      whileTap={disabled ? undefined : ctaFeedback}
      type={type}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={variant === "filled" ? filledStyle : ghostStyle}
      className={[
        "relative inline-flex items-center justify-center rounded-2xl",
        "tracking-tight select-none outline-none",
        "transition-opacity",
        SIZES[size],
        fullWidth ? "w-full" : "",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        "focus-visible:ring-2 focus-visible:ring-offset-2",
      ].filter(Boolean).join(" ")}
      aria-disabled={disabled}
    >
      {children}
    </motion.button>
  );
}
