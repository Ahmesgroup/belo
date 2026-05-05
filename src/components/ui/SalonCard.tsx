"use client";

import Link      from "next/link";
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { staggerItem, tap } from "@/lib/motion/presets";
import { getIntentColor } from "@/lib/design/intent";
import { preloadSlots } from "@/lib/cache/slotCache";

// ── Types ─────────────────────────────────────────────────────

export interface SalonCardData {
  id:           string;
  name:         string;
  slug:         string;
  city?:        string | null;
  plan:         string;
  coverUrl?:    string | null;
  ratingAvg?:   number;
  distance?:    number | null;    // km
  bookings24h?: number;
  trendingScore?:number;
  priceFrom?:   number | null;    // priceCents of cheapest service
  currency?:    string;
  isFavorite?:  boolean;
  /** Créneaux restants — source backend UNIQUEMENT. Jamais recalculé UI. */
  remainingSlots?: number;
  /** Réservations de la semaine — pour la preuve sociale */
  weeklyBookings?: number;
}

interface SalonCardProps {
  salon:              SalonCardData;
  lang?:              string;
  onFavoriteToggle?:  (salonId: string, next: boolean) => void;
  className?:         string;
  /** Calculé par getBestSalonId() dans le parent — jamais dans ce composant */
  highlight?:         boolean;
  /** Callback quand l'utilisateur veut réserver (ouvrir le drawer) */
  onBook?:            (salon: SalonCardData) => void;
}

// ── Helpers ───────────────────────────────────────────────────

function planBadge(plan: string) {
  if (plan === "PREMIUM") return { bg: "bg-purple/20 text-purple",     label: "★ Premium" };
  if (plan === "PRO")     return { bg: "bg-amber/20 text-amber",        label: "⚡ PRO"     };
  return null;
}

function trendBadge(score: number, bookings: number) {
  if (score > 50 || bookings >= 5)  return { bg: "bg-red/10 text-red",     label: "🔥 Très demandé" };
  if (score > 20 || bookings >= 2)  return { bg: "bg-amber/10 text-amber",  label: "⚡ Actif"        };
  return null;
}

function formatPrice(cents: number, currency = "XOF") {
  if (currency === "EUR") return `À partir de ${Math.round(cents / 100)} €`;
  return `À partir de ${(cents / 100).toLocaleString("fr")} FCFA`;
}

function formatDist(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// ── Component ─────────────────────────────────────────────────

export function SalonCard({
  salon,
  lang = "fr",
  onFavoriteToggle,
  className = "",
  highlight = false,
  onBook,
}: SalonCardProps) {
  const [imgErr,   setImgErr]   = useState(false);
  const [favState, setFavState] = useState(salon.isFavorite ?? false);

  // Préchauffage du cache créneaux au hover / tap start
  const handlePreload = useCallback(() => {
    preloadSlots(salon.id).catch(() => {});
  }, [salon.id]);

  const pb   = planBadge(salon.plan);
  const tb   = trendBadge(salon.trendingScore ?? 0, salon.bookings24h ?? 0);
  const isFr = lang === "fr";

  function handleFav(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !favState;
    setFavState(next);
    onFavoriteToggle?.(salon.id, next);
  }

  const socialProof = (salon.weeklyBookings ?? 0) >= 20;

  return (
    <motion.div
      variants={staggerItem}
      whileTap={tap}
      onHoverStart={handlePreload}
      onTapStart={handlePreload}
      className={`
        group rounded-2xl bg-card border overflow-hidden
        shadow-soft hover:shadow-card
        transition-shadow duration-200
        ${highlight ? "ring-2" : ""}
        ${className}
      `}
      style={highlight ? { borderColor: getIntentColor("cta") } : {}}
    >
    <Link
      href={`/booking/${salon.slug}`}
      className="block"
      aria-label={`Réserver ${salon.name}`}
      onClick={onBook ? (e) => { e.preventDefault(); onBook(salon); } : undefined}
    >
      {/* ── Image ──────────────────────────────────────────── */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-[#1a2a1a] to-[#0d2d1a] overflow-hidden">
        {salon.coverUrl && !imgErr ? (
          <img
            src={salon.coverUrl}
            alt={salon.name}
            loading="lazy"
            decoding="async"
            onError={() => setImgErr(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-5xl select-none">
            💇‍♀️
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {tb && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm ${tb.bg}`}>
                {tb.label}
              </span>
            )}
            {pb && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm ${pb.bg}`}>
                {pb.label}
              </span>
            )}
          </div>

          {/* Favorite button */}
          <button
            type="button"
            onClick={handleFav}
            aria-label={favState ? "Retirer des favoris" : "Ajouter aux favoris"}
            className="
              w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm
              flex items-center justify-center
              hover:bg-black/60 active:scale-90
              transition-all duration-150
              text-base leading-none shrink-0
            "
          >
            {favState ? "❤️" : "🤍"}
          </button>
        </div>

        {/* Distance badge (bottom-left) */}
        {salon.distance != null && (
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            📍 {formatDist(salon.distance)}
          </div>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-serif font-bold text-sm leading-tight line-clamp-1 group-hover:text-g2 transition-colors">
            {salon.name}
          </h3>
          {(salon.ratingAvg ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-xs font-semibold text-amber shrink-0">
              ⭐ {salon.ratingAvg?.toFixed(1)}
            </span>
          )}
        </div>

        {salon.city && (
          <p className="text-text3 text-xs mb-3 truncate">📍 {salon.city}</p>
        )}

        {salon.priceFrom && salon.priceFrom > 0 && (
          <p className="text-text3 text-[11px] mb-2">
            {formatPrice(salon.priceFrom, salon.currency)}
          </p>
        )}

        {/* Créneaux restants — données backend uniquement */}
        {salon.remainingSlots !== undefined && (
          <p
            className="text-[11px] font-semibold mb-2"
            style={{
              color: salon.remainingSlots === 0
                ? "#6B7280"
                : getIntentColor("success"),
            }}
          >
            {salon.remainingSlots === 0
              ? (isFr ? "Complet" : "Fully booked")
              : `${salon.remainingSlots} créneau${salon.remainingSlots > 1 ? "x" : ""} restant${salon.remainingSlots > 1 ? "s" : ""}`}
          </p>
        )}

        {/* Preuve sociale — seulement si données réelles >= 20 */}
        {socialProof && (
          <p className="text-[10px] text-text3 mb-2">
            🔥 {salon.weeklyBookings}+ réservations cette semaine
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <span
            className="flex-1 text-center py-2 rounded-xl text-xs font-bold text-white transition-opacity"
            style={{ backgroundColor: getIntentColor("cta") }}
          >
            {isFr ? "Réserver →" : "Book →"}
          </span>
        </div>
      </div>
    </Link>
    </motion.div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────

export function SalonCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl bg-card border border-border overflow-hidden animate-pulse ${className}`}>
      <div className="aspect-[4/3] bg-card2" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-card2 rounded-lg w-3/4" />
        <div className="h-3 bg-card2 rounded-lg w-1/2" />
        <div className="h-9 bg-card2 rounded-xl mt-3" />
      </div>
    </div>
  );
}
