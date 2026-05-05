"use client";

import { motion } from "framer-motion";
import { staggerItem, tap } from "@/lib/motion/presets";
import { StatusBadge, type BookingStatus } from "@/components/ui/StatusBadge";
import { MotionTap } from "@/components/motion/MotionTap";

export interface BookingCardData {
  id:          string;
  salonName:   string;
  serviceName: string;
  /** ISO date string */
  date:        string;
  time:        string;
  status:      BookingStatus;
  /** En XOF */
  priceCents:  number;
  salonPhone?: string;
}

interface BookingCardProps {
  booking:     BookingCardData;
  onDetails?:  (id: string) => void;
  onMessage?:  (id: string) => void;
  onCancel?:   (id: string) => void;
}

function formatPrice(cents: number): string {
  return `${cents.toLocaleString("fr-FR")} XOF`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day:     "numeric",
    month:   "short",
  });
}

export function BookingCard({
  booking,
  onDetails,
  onMessage,
  onCancel,
}: BookingCardProps) {
  const isCancellable =
    booking.status === "pending" || booking.status === "confirmed";

  return (
    <motion.article
      variants={staggerItem}
      className="rounded-2xl bg-card border border-border overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Titre — noir */}
          <h3 className="font-bold text-sm text-text leading-tight truncate">
            {booking.salonName}
          </h3>
          {/* Service — noir, légèrement plus petit */}
          <p className="text-text text-xs mt-0.5 truncate">
            {booking.serviceName}
          </p>
        </div>

        {/* Statut — 1 seul signal couleur */}
        <StatusBadge status={booking.status} />
      </div>

      {/* Séparateur */}
      <div className="mx-4 border-t border-border" />

      {/* Meta — gris */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-text3 text-xs">
          <span>📅 {formatDate(booking.date)}</span>
          <span>⏰ {booking.time}</span>
        </div>

        {/* Prix — noir + bold */}
        <span className="font-bold text-sm text-text">
          {formatPrice(booking.priceCents)}
        </span>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <MotionTap
          onClick={() => onDetails?.(booking.id)}
          className="flex-1 py-2 rounded-xl border border-border bg-card2 text-text text-xs font-semibold text-center"
        >
          Détails
        </MotionTap>

        {booking.salonPhone && (
          <MotionTap
            onClick={() => onMessage?.(booking.id)}
            className="flex-1 py-2 rounded-xl border border-border bg-card2 text-text text-xs font-semibold text-center"
          >
            Message
          </MotionTap>
        )}

        {isCancellable && (
          <MotionTap
            onClick={() => onCancel?.(booking.id)}
            className="flex-1 py-2 rounded-xl border text-xs font-semibold text-center"
            style={{
              borderColor: "rgba(220,38,38,.25)",
              color:       "#DC2626",
              background:  "rgba(220,38,38,.06)",
            } as React.CSSProperties}
          >
            Annuler
          </MotionTap>
        )}
      </div>
    </motion.article>
  );
}
