"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { staggerContainer, staggerItem } from "@/lib/motion/presets";
import { tap } from "@/lib/motion/presets";
import { getIntentColor } from "@/lib/design/intent";

export interface HeroSalon {
  id:       string;
  name:     string;
  city:     string;
  coverUrl: string;
  /** blur data URL for placeholder */
  blurDataURL?: string;
  rating:   number;
  reviewCount: number;
  /** Catégorie principale du salon */
  category: string;
  slug:     string;
}

interface SalonHeroProps {
  salons:    HeroSalon[];
  onSelect?: (salon: HeroSalon) => void;
}

function RatingBadge({ rating, count }: { rating: number; count: number }) {
  return (
    <div
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-white text-xs font-semibold"
      style={{
        background:    "rgba(255,255,255,.18)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border:        "1px solid rgba(255,255,255,.25)",
      }}
    >
      <span style={{ color: getIntentColor("success") }}>★</span>
      <span>{rating.toFixed(1)}</span>
      <span className="opacity-70">({count})</span>
    </div>
  );
}

function HeroCard({
  salon,
  index,
  onSelect,
}: {
  salon:    HeroSalon;
  index:    number;
  onSelect?: (s: HeroSalon) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Micro-parallax LÉGER — imperceptible, ressenti premium
  const { scrollYProgress } = useScroll({
    target:  cardRef,
    offset:  ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, -20]);

  return (
    <motion.div
      ref={cardRef}
      variants={staggerItem}
      whileTap={tap}
      onClick={() => onSelect?.(salon)}
      className="relative flex-shrink-0 overflow-hidden cursor-pointer select-none"
      style={{
        width:  "85vw",
        height: 400,
        maxWidth: 340,
        borderRadius: 24,
        scrollSnapAlign: "start",
      }}
    >
      {/* Image avec parallax */}
      <motion.div
        style={{ y, position: "absolute", inset: "-10% 0", height: "120%" }}
      >
        <Image
          src={salon.coverUrl}
          alt={salon.name}
          fill
          priority={index === 0}
          placeholder={salon.blurDataURL ? "blur" : "empty"}
          blurDataURL={salon.blurDataURL}
          sizes="(max-width: 480px) 85vw, 340px"
          style={{ objectFit: "cover" }}
        />
      </motion.div>

      {/* Gradient overlay — lisibilité du texte */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,.20) 50%, transparent 100%)",
        }}
      />

      {/* Badge rating — glass effect, coin supérieur droit */}
      <div className="absolute top-3 right-3">
        <RatingBadge rating={salon.rating} count={salon.reviewCount} />
      </div>

      {/* Texte en bas */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white/70 text-xs font-medium mb-1 uppercase tracking-wide">
          {salon.category} · {salon.city}
        </p>
        <h3 className="text-white font-bold text-lg leading-tight">
          {salon.name}
        </h3>
      </div>
    </motion.div>
  );
}

export function SalonHero({ salons, onSelect }: SalonHeroProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex gap-4 overflow-x-auto pb-2"
      style={{
        scrollSnapType:        "x mandatory",
        scrollBehavior:        "smooth",
        WebkitOverflowScrolling: "touch",
        paddingLeft:  16,
        paddingRight: 16,
        // Hide scrollbar cross-browser
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {salons.map((salon, i) => (
        <HeroCard
          key={salon.id}
          salon={salon}
          index={i}
          onSelect={onSelect}
        />
      ))}
    </motion.div>
  );
}
