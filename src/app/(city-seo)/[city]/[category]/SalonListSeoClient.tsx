"use client";

/**
 * SalonListSeoClient — chargement dynamique des créneaux.
 * Rendu côté client UNIQUEMENT pour les slots (temps réel).
 * La liste des salons reste SSG (statique + cache ISR).
 */

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

interface Slot {
  id:       string;
  startsAt: string;
  salonName: string;
  salonSlug: string;
}

interface Props {
  city:     string;
  category: string;
}

function TimeChip({ slot }: { slot: Slot }) {
  const time = new Date(slot.startsAt).toLocaleTimeString("fr-FR", {
    hour:   "2-digit",
    minute: "2-digit",
  });

  return (
    <a
      href={`/booking/${slot.salonSlug}`}
      className="flex-shrink-0 px-3 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-text hover:border-intent-cta transition-colors"
      onClick={() => track("seo_booking_start")}
    >
      <span className="block text-[10px] text-text3 mb-0.5 truncate max-w-[80px]">
        {slot.salonName.slice(0, 12)}
      </span>
      {time}
    </a>
  );
}

export function SalonListSeoClient({ city, category }: Props) {
  const [slots, setSlots]   = useState<Slot[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    track("seo_page_view", { city, category });

    fetch(
      `/api/slots?city=${encodeURIComponent(city)}&category=${encodeURIComponent(category)}&limit=8`,
    )
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d: { data?: { slots?: Slot[] } }) => {
        setSlots(d.data?.slots ?? []);
        if ((d.data?.slots ?? []).length === 0) {
          track("seo_zero_results", { city, category });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [city, category]);

  if (!loaded) return null; // Skeleton rendu par Suspense fallback

  if (slots.length === 0) {
    return (
      <p className="px-4 text-xs text-text3">
        Aucun créneau disponible pour le moment — réservez directement auprès d&apos;un salon.
      </p>
    );
  }

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2"
      style={{ paddingLeft: 16, paddingRight: 16, scrollbarWidth: "none" }}
    >
      {slots.map((slot) => (
        <TimeChip key={slot.id} slot={slot} />
      ))}
    </div>
  );
}
