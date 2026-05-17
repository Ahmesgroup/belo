"use client";

/**
 * SalonCard — Editorial beauty card.
 *
 * RÈGLES VISUELLES :
 * - Pas de border, pas de shadow, pas de bg-card sur le wrapper
 * - Image dominante en ratio 4/5 (Pinterest editorial), rounded-[28px]
 * - Contenu sous l'image, sans container — respire dans la page
 * - CTA inline (texte vert), jamais un bouton fintech
 * - Badges minimaux : Premium/Pro = texte uppercase discret sur l'image
 * - Heart : SVG outline 18px, intégré, jamais cerclé en noir
 * - Distance + rating : texte ombré sur l'image, jamais badges
 * - remainingSlots ≤ 3 = signal d'urgence subtil, data-driven backend
 *
 * Direction : Glossier × Aesop × Treatwell — jamais Stripe ou Uber.
 */

import Link              from "next/link";
import { useState, useCallback } from "react";
import { motion }        from "framer-motion";
import { staggerItem, tap } from "@/lib/motion/presets";
import { getIntentColor } from "@/lib/design/intent";
import { preloadSlots }  from "@/lib/cache/slotCache";

// ── Types ─────────────────────────────────────────────────────

export interface SalonCardData {
  id:              string;
  name:            string;
  slug:            string;
  city?:           string | null;
  plan:            string;
  coverUrl?:       string | null;
  ratingAvg?:      number;
  distance?:       number | null;    // km
  bookings24h?:    number;
  trendingScore?:  number;
  priceFrom?:      number | null;    // priceCents of cheapest service
  currency?:       string;
  isFavorite?:     boolean;
  /** Créneaux restants — source backend UNIQUEMENT */
  remainingSlots?: number;
  /** Réservations de la semaine — pour la preuve sociale */
  weeklyBookings?: number;
}

interface SalonCardProps {
  salon:              SalonCardData;
  lang?:              string;
  onFavoriteToggle?:  (salonId: string, next: boolean) => void;
  className?:         string;
  /** Calculé par getBestSalonId() dans le parent — jamais ici */
  highlight?:         boolean;
  /** Callback quand l'utilisateur veut réserver (ouvrir le drawer) */
  onBook?:            (salon: SalonCardData) => void;
}

// ── Helpers ───────────────────────────────────────────────────

function formatPrice(cents: number, currency = "XOF"): string {
  if (currency === "EUR") return `Dès ${Math.round(cents / 100)} €`;
  return `Dès ${(cents / 100).toLocaleString("fr")} FCFA`;
}

function formatDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function planLabel(plan: string): string | null {
  if (plan === "PREMIUM") return "Premium";
  if (plan === "PRO")     return "Pro";
  return null;
}

// ── Icons (SVG outline — jamais d'emoji) ──────────────────────

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24"
      fill={filled ? "#ffffff" : "none"}
      stroke="#ffffff" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.3))" }}
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function PortraitFallback() {
  return (
    <svg
      width="56" height="56" viewBox="0 0 56 56"
      fill="none" stroke="currentColor" strokeWidth="1.2"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="28" cy="22" r="8" />
      <path d="M12 46c0-8 7-14 16-14s16 6 16 14" />
    </svg>
  );
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

  const handlePreload = useCallback(() => {
    preloadSlots(salon.id).catch(() => {});
  }, [salon.id]);

  function handleFav(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !favState;
    setFavState(next);
    onFavoriteToggle?.(salon.id, next);
  }

  const isFr            = lang === "fr";
  const planText        = planLabel(salon.plan);
  const showUrgency     = salon.remainingSlots !== undefined
                          && salon.remainingSlots > 0
                          && salon.remainingSlots <= 3;
  const isFullyBooked   = salon.remainingSlots === 0;

  return (
    <motion.div
      variants={staggerItem}
      whileTap={tap}
      onHoverStart={handlePreload}
      onTapStart={handlePreload}
      className={`group block select-none ${className}`}
    >
      <Link
        href={`/booking/${salon.slug}`}
        className="block"
        aria-label={isFr ? `Réserver ${salon.name}` : `Book ${salon.name}`}
        onClick={onBook ? (e) => { e.preventDefault(); onBook(salon); } : undefined}
      >
        {/* ── IMAGE — élément dominant ─────────────────────── */}
        <div
          className="relative aspect-[4/5] overflow-hidden"
          style={{ borderRadius: 28 }}
        >
          {salon.coverUrl && !imgErr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={salon.coverUrl}
              alt={salon.name}
              loading="lazy"
              decoding="async"
              onError={() => setImgErr(true)}
              className="w-full h-full object-cover transition-transform duration-[700ms] ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: "var(--card2)", color: "var(--text3)" }}
            >
              <PortraitFallback />
            </div>
          )}

          {/* Gradient bas — uniquement pour lisibilité du texte gravé */}
          <div
            className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,.35) 0%, transparent 100%)",
            }}
            aria-hidden="true"
          />

          {/* Plan — uniquement Premium/Pro, texte minuscule en haut à gauche */}
          {planText && (
            <span
              className="absolute top-3 left-4 text-[10px] font-medium uppercase tracking-[0.18em]"
              style={{
                color:      "rgba(255,255,255,.92)",
                textShadow: "0 1px 2px rgba(0,0,0,.35)",
              }}
            >
              {planText}
            </span>
          )}

          {/* Heart — petit, intégré, sans cercle */}
          <button
            type="button"
            onClick={handleFav}
            aria-label={favState
              ? (isFr ? "Retirer des favoris" : "Remove from favorites")
              : (isFr ? "Ajouter aux favoris" : "Add to favorites")}
            className="absolute top-2.5 right-3 w-7 h-7 flex items-center justify-center transition-opacity"
            style={{ opacity: favState ? 1 : 0.85 }}
          >
            <HeartIcon filled={favState} />
          </button>

          {/* Ligne basse : distance · rating — texte ombré sur l'image */}
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
            <span
              className="text-[11px] font-medium tracking-wide"
              style={{
                color:      "rgba(255,255,255,.95)",
                textShadow: "0 1px 2px rgba(0,0,0,.4)",
              }}
            >
              {salon.distance != null && formatDist(salon.distance)}
            </span>

            {(salon.ratingAvg ?? 0) > 0 && (
              <span
                className="text-[11px] font-medium tracking-wide"
                style={{
                  color:      "rgba(255,255,255,.95)",
                  textShadow: "0 1px 2px rgba(0,0,0,.4)",
                }}
              >
                {salon.ratingAvg?.toFixed(1)} ★
              </span>
            )}
          </div>
        </div>

        {/* ── CONTENU — sans container, respire dans la page ── */}
        <div className="pt-4 pb-2 px-1">
          {/* Ville — meta gris, hairline */}
          {salon.city && (
            <p
              className="text-[11px] uppercase tracking-[0.12em] mb-1.5"
              style={{ color: "var(--text3)" }}
            >
              {salon.city}
            </p>
          )}

          {/* Nom — Fraunces editorial */}
          <h3
            className="font-heading font-semibold leading-snug mb-1.5 transition-colors"
            style={{
              fontSize: 18,
              color:    "var(--text)",
              letterSpacing: "-0.005em",
            }}
          >
            {salon.name}
          </h3>

          {/* Prix — discret */}
          {salon.priceFrom && salon.priceFrom > 0 && (
            <p
              className="text-[12px] mb-3"
              style={{ color: "var(--text2)" }}
            >
              {formatPrice(salon.priceFrom, salon.currency)}
            </p>
          )}

          {/* CTA inline — jamais un bouton fintech */}
          <div className="flex items-center justify-between gap-3">
            <span
              className="text-[12px] font-medium tracking-wide transition-opacity group-hover:opacity-100"
              style={{
                color:   isFullyBooked ? "var(--text3)" : getIntentColor("cta"),
                opacity: isFullyBooked ? 0.6           : 0.85,
              }}
            >
              {isFullyBooked
                ? (isFr ? "Complet"   : "Fully booked")
                : (isFr ? "Réserver"  : "Book")}
              {!isFullyBooked && (
                <span className="ml-1 transition-transform inline-block group-hover:translate-x-0.5">→</span>
              )}
            </span>

            {/* Signal urgence — data-driven backend, jamais inventé */}
            {highlight && !isFullyBooked && (
              <span
                className="text-[10px] font-medium uppercase tracking-[0.14em]"
                style={{ color: getIntentColor("success") }}
              >
                {isFr ? "Le plus proche" : "Closest"}
              </span>
            )}

            {showUrgency && !highlight && (
              <span
                className="text-[10px]"
                style={{ color: getIntentColor("success") }}
              >
                {salon.remainingSlots === 1
                  ? (isFr ? "1 créneau"  : "1 slot")
                  : (isFr ? `${salon.remainingSlots} créneaux` : `${salon.remainingSlots} slots`)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Skeleton — même structure éditoriale ──────────────────────

export function SalonCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`block ${className}`}>
      <div
        className="aspect-[4/5] animate-pulse"
        style={{ borderRadius: 28, background: "var(--card2)" }}
      />
      <div className="pt-4 px-1 space-y-2">
        <div className="h-2.5 w-1/3 animate-pulse rounded-full" style={{ background: "var(--card2)" }} />
        <div className="h-4 w-3/4 animate-pulse rounded-md" style={{ background: "var(--card2)" }} />
        <div className="h-3 w-1/3 animate-pulse rounded-md" style={{ background: "var(--card2)" }} />
      </div>
    </div>
  );
}
