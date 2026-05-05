"use client";

import { motion } from "framer-motion";
import { slideUp, tap } from "@/lib/motion/presets";
import { getIntentColor } from "@/lib/design/intent";
import { MotionTap } from "@/components/motion/MotionTap";

export interface ReceiptData {
  bookingId:   string;
  salonName:   string;
  serviceName: string;
  /** ISO date */
  date:        string;
  time:        string;
  priceCents:  number;
  depositCents?: number;
  currency?:   string;
  salonPhone?: string;
}

interface ReceiptProps {
  receipt:    ReceiptData;
  onContact?: () => void;
  onRebook?:  () => void;
}

function formatPrice(cents: number, currency = "XOF"): string {
  return `${cents.toLocaleString("fr-FR")} ${currency}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
  });
}

/** Check circle vert — PAS de glow effect */
function CheckCircle() {
  return (
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
      style={{ backgroundColor: "rgba(29,185,84,.15)" }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 16l5.5 5.5L24 11"
          stroke={getIntentColor("success")}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function Divider() {
  return (
    <div
      className="my-4"
      style={{
        borderTop: "1px dashed rgba(255,255,255,.12)",
      }}
    />
  );
}

function Row({
  label,
  value,
  isTotal = false,
}: {
  label:   string;
  value:   string;
  isTotal?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-1">
      <span
        className="text-xs"
        style={{ color: isTotal ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.5)" }}
      >
        {label}
      </span>
      <span
        className={isTotal ? "font-bold text-sm" : "text-xs font-medium text-white/80"}
        style={{ color: isTotal ? getIntentColor("success") : undefined }}
      >
        {value}
      </span>
    </div>
  );
}

export function Receipt({ receipt, onContact, onRebook }: ReceiptProps) {
  const currency = receipt.currency ?? "XOF";
  const balance  = receipt.depositCents != null
    ? receipt.priceCents - receipt.depositCents
    : receipt.priceCents;

  return (
    <motion.div
      variants={slideUp}
      initial="hidden"
      animate="visible"
      className="rounded-3xl p-6 select-none"
      style={{ backgroundColor: "#0A0A0A" }}
    >
      <CheckCircle />

      {/* Titre */}
      <h2 className="text-white font-bold text-xl text-center mb-1">
        Réservation confirmée
      </h2>
      <p
        className="text-center text-sm mb-6"
        style={{ color: "rgba(255,255,255,.5)" }}
      >
        Réf. #{receipt.bookingId.slice(-8).toUpperCase()}
      </p>

      {/* Infos réservation */}
      <div className="space-y-0.5">
        <Row label="Salon"    value={receipt.salonName} />
        <Row label="Service"  value={receipt.serviceName} />
        <Row label="Date"     value={formatDate(receipt.date)} />
        <Row label="Heure"    value={receipt.time} />
      </div>

      <Divider />

      {/* Tarifs */}
      {receipt.depositCents != null && receipt.depositCents > 0 && (
        <Row
          label="Acompte payé"
          value={formatPrice(receipt.depositCents, currency)}
        />
      )}
      {receipt.depositCents != null && receipt.depositCents > 0 && (
        <Row
          label="Reste à payer en salon"
          value={formatPrice(balance, currency)}
        />
      )}

      <Divider />

      {/* Total — en vert via intent-success */}
      <Row
        label="Total"
        value={formatPrice(receipt.priceCents, currency)}
        isTotal
      />

      {/* CTA */}
      <div className="flex gap-3 mt-6">
        {receipt.salonPhone && (
          <motion.button
            whileTap={tap}
            onClick={onContact}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold"
            style={{
              backgroundColor: "rgba(255,255,255,.08)",
              color:           "rgba(255,255,255,.85)",
              border:          "1px solid rgba(255,255,255,.12)",
            }}
          >
            Contacter salon
          </motion.button>
        )}
        <motion.button
          whileTap={tap}
          onClick={onRebook}
          className="flex-1 py-3 rounded-2xl text-sm font-bold text-white"
          style={{ backgroundColor: getIntentColor("cta") }}
        >
          Rebook
        </motion.button>
      </div>
    </motion.div>
  );
}
