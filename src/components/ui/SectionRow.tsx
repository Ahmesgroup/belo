"use client";

import Link from "next/link";
import { useRef }     from "react";
import { SalonCard, SalonCardSkeleton, type SalonCardData } from "./SalonCard";

// ── Types ─────────────────────────────────────────────────────

interface SectionRowProps {
  title:      string;
  emoji?:     string;
  subtitle?:  string;
  seeAllHref?: string;
  seeAllLabel?: string;
  salons:     SalonCardData[];
  loading?:   boolean;
  skeletonCount?: number;
  lang?:      string;
  onFavoriteToggle?: (salonId: string, next: boolean) => void;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────

export function SectionRow({
  title,
  emoji,
  subtitle,
  seeAllHref,
  seeAllLabel = "Voir tout →",
  salons,
  loading    = false,
  skeletonCount = 4,
  lang       = "fr",
  onFavoriteToggle,
  className  = "",
}: SectionRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: 1 | -1) {
    scrollRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  }

  const showEmpty  = !loading && salons.length === 0;
  const showCards  = !loading && salons.length > 0;

  return (
    <section className={`${className}`} aria-label={title}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <h2 className="font-serif text-lg font-bold flex items-center gap-2">
            {emoji && <span aria-hidden="true">{emoji}</span>}
            {title}
          </h2>
          {subtitle && <p className="text-text3 text-xs mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {/* Scroll arrows (desktop) */}
          <div className="hidden sm:flex gap-1">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label="Précédent"
              className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-text3 hover:text-text hover:bg-card2 transition-colors"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label="Suivant"
              className="w-8 h-8 rounded-full border border-border2 flex items-center justify-center text-text3 hover:text-text hover:bg-card2 transition-colors"
            >
              →
            </button>
          </div>
          {seeAllHref && (
            <Link href={seeAllHref} className="text-g2 text-sm font-semibold hover:text-g3 transition-colors whitespace-nowrap">
              {seeAllLabel}
            </Link>
          )}
        </div>
      </div>

      {/* Horizontal scroll rail */}
      <div
        ref={scrollRef}
        className="
          flex gap-4 overflow-x-auto
          scroll-smooth snap-x snap-mandatory
          pb-3 -mx-1 px-1
          scrollbar-none
        "
        style={{ scrollbarWidth: "none" }}
      >
        {/* Skeletons */}
        {loading && Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="snap-start shrink-0 w-[220px] sm:w-[240px]">
            <SalonCardSkeleton />
          </div>
        ))}

        {/* Cards */}
        {showCards && salons.map(salon => (
          <div key={salon.id} className="snap-start shrink-0 w-[220px] sm:w-[240px]">
            <SalonCard
              salon={salon}
              lang={lang}
              onFavoriteToggle={onFavoriteToggle}
            />
          </div>
        ))}

        {/* Empty state — always show suggestions fallback */}
        {showEmpty && (
          <div className="flex items-center justify-center w-full py-10 text-text3 text-sm">
            {lang === "fr" ? "Aucun salon disponible pour l'instant." : "No salons available yet."}
          </div>
        )}
      </div>

      {/* Mobile "Voir tout" */}
      {seeAllHref && !loading && salons.length > 0 && (
        <div className="mt-3 text-center sm:hidden">
          <Link href={seeAllHref} className="text-g2 text-sm font-semibold hover:text-g3">
            {seeAllLabel}
          </Link>
        </div>
      )}
    </section>
  );
}
