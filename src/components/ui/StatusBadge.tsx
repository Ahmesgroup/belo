"use client";

import { getIntentColor, getIntentBg, type Intent } from "@/lib/design/intent";

export type BookingStatus = "confirmed" | "pending" | "cancelled" | "completed" | "no_show";

const STATUS_TO_INTENT: Record<BookingStatus, Intent> = {
  confirmed: "success",
  completed: "success",
  pending:   "muted",
  cancelled: "error",
  no_show:   "error",
} as const;

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "Confirmé",
  completed: "Terminé",
  pending:   "En attente",
  cancelled: "Annulé",
  no_show:   "Absent",
} as const;

interface StatusBadgeProps {
  status: BookingStatus;
  /** Taille du badge */
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const intent = STATUS_TO_INTENT[status];
  const color  = getIntentColor(intent);
  const bg     = getIntentBg(intent);
  const label  = STATUS_LABEL[status];

  const sizeClass = size === "sm"
    ? "px-2.5 py-0.5 text-[11px]"
    : "px-3 py-1 text-xs";

  return (
    <span
      style={{ color, backgroundColor: bg }}
      className={[
        "inline-flex items-center gap-1 rounded-full font-semibold",
        "tracking-wide uppercase leading-none",
        sizeClass,
      ].join(" ")}
    >
      {/* 1 seul signal couleur : pas d'icône supplémentaire */}
      {label}
    </span>
  );
}
