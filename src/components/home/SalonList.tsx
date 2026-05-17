"use client";

import { motion } from "framer-motion";
import { staggerContainer, staggerItem, tap } from "@/lib/motion/presets";
import { getIntentColor } from "@/lib/design/intent";

export interface ListSalon {
  id:       string;
  name:     string;
  city:     string;
  slug:     string;
  rating:   number;
  /** Tarif minimum en XOF */
  minPriceCents: number;
  category: string;
  isAvailable: boolean;
  photoUrl?: string;
}

interface SalonListProps {
  salons:    ListSalon[];
  onSelect?: (salon: ListSalon) => void;
  /** Mode horizontal snap-scroll ou vertical */
  layout?: "horizontal" | "vertical";
}

function AvailabilityDot({ available }: { available: boolean }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full"
      style={{
        backgroundColor: available
          ? getIntentColor("success")
          : getIntentColor("muted"),
      }}
      aria-label={available ? "Disponible" : "Indisponible"}
    />
  );
}

function SalonCard({
  salon,
  onSelect,
}: {
  salon:    ListSalon;
  onSelect?: (s: ListSalon) => void;
}) {
  const priceLabel = salon.minPriceCents > 0
    ? `À partir de ${(salon.minPriceCents).toLocaleString("fr-FR")} XOF`
    : "Prix sur demande";

  return (
    <motion.div
      variants={staggerItem}
      whileTap={tap}
      onClick={() => onSelect?.(salon)}
      className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border cursor-pointer select-none"
      style={{ minWidth: 260, maxWidth: 300 }}
    >
      {/* Thumbnail */}
      <div
        className="flex-shrink-0 rounded-xl bg-card2 overflow-hidden"
        style={{ width: 56, height: 56 }}
      >
        {salon.photoUrl ? (
          <img
            src={salon.photoUrl}
            alt={salon.name}
            width={56}
            height={56}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            💇
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {/* Titre — noir, seul signal fort */}
        <p className="font-semibold text-sm text-text leading-tight truncate">
          {salon.name}
        </p>

        {/* Prix — noir bold */}
        <p className="font-bold text-xs text-text mt-0.5">
          {priceLabel}
        </p>

        {/* Meta — gris */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-text3">
            ★ {salon.rating.toFixed(1)}
          </span>
          <span className="text-text3">·</span>
          <span className="text-[11px] text-text3 truncate">{salon.city}</span>
        </div>
      </div>

      {/* 1 seul signal couleur : disponibilité */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <AvailabilityDot available={salon.isAvailable} />
        <span
          className="text-[10px] font-medium"
          style={{
            color: salon.isAvailable
              ? getIntentColor("success")
              : getIntentColor("muted"),
          }}
        >
          {salon.isAvailable ? "Dispo" : "Complet"}
        </span>
      </div>
    </motion.div>
  );
}

export function SalonList({ salons, onSelect, layout = "vertical" }: SalonListProps) {
  const isHorizontal = layout === "horizontal";

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={
        isHorizontal
          ? "flex gap-3 overflow-x-auto pb-2"
          : "flex flex-col gap-3"
      }
      style={
        isHorizontal
          ? {
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              paddingLeft: 16,
              paddingRight: 16,
            }
          : undefined
      }
    >
      {salons.map((salon) => (
        <SalonCard
          key={salon.id}
          salon={salon}
          onSelect={onSelect}
        />
      ))}
    </motion.div>
  );
}
