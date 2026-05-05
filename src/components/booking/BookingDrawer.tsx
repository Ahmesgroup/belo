"use client";

/**
 * BookingDrawer — bottom sheet de réservation.
 *
 * RÈGLES :
 * - lockScroll / unlockScroll sur mount/unmount
 * - Slots = backend uniquement, jamais recalculés
 * - data null → <ErrorState type="network" />
 * - Auto-select si slots.length === 1 + signal visuel
 * - nextAvailableSlot → sync date ET slot ensemble
 * - Zéro fetch dans ce composant — tout passe par slotCache
 * - 1 priorité visuelle par écran
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MOTION } from "@/lib/motion/motion";
import { getIntentColor } from "@/lib/design/intent";
import { lockScroll, unlockScroll } from "@/lib/scroll/scrollLock";
import { preloadSlots, getSlots, invalidateSlots } from "@/lib/cache/slotCache";
import { useBookingAction } from "@/hooks/useBookingAction";
import { getUser } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { SlotsSkeleton } from "@/components/ui/SlotsSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { BookingButton } from "@/components/booking/BookingButton";
import type { Salon, Service, Slot, SlotsData } from "@/types";

// ── HELPERS ───────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour:   "2-digit",
    minute: "2-digit",
  });
}

function formatDayLabel(date: Date): string {
  const today = new Date();
  const diff   = Math.round((date.getTime() - today.setHours(0,0,0,0)) / 86_400_000);
  if (diff === 0) return "Auj.";
  if (diff === 1) return "Dem.";
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

function getNext7Days(): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

// ── PROPS ─────────────────────────────────────────────────────

interface BookingDrawerProps {
  salon:     Salon;
  isOpen:    boolean;
  onClose:   () => void;
  onSuccess?: () => void;
}

// ── SUB-COMPONENTS ────────────────────────────────────────────

function ServicePicker({
  services,
  selected,
  onSelect,
}: {
  services:  Service[];
  selected:  Service | null;
  onSelect:  (s: Service) => void;
}) {
  if (services.length === 0) return null;

  if (selected) {
    return (
      <div className="px-4 mb-4">
        <p className="text-[10px] font-semibold text-text3 uppercase tracking-widest mb-2">
          Service
        </p>
        <div
          className="flex items-center justify-between p-3 rounded-xl"
          style={{ backgroundColor: getIntentColor("cta") + "14" }}
        >
          <span className="text-sm font-semibold text-text">{selected.name}</span>
          <span className="text-xs font-bold text-text">
            {selected.priceCents.toLocaleString("fr-FR")} FCFA
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 mb-4">
      <p className="text-[10px] font-semibold text-text3 uppercase tracking-widest mb-2">
        Choisissez un service
      </p>
      <div className="flex flex-col gap-2">
        {services.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s)}
            className="flex items-center justify-between p-3 rounded-xl bg-card2 border border-border text-left"
          >
            <div>
              <span className="text-sm font-semibold text-text block">{s.name}</span>
              <span className="text-xs text-text3">{s.durationMin} min</span>
            </div>
            <span className="text-sm font-bold text-text">
              {s.priceCents.toLocaleString("fr-FR")} FCFA
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DatePicker({
  days,
  selected,
  onSelect,
}: {
  days:     Date[];
  selected: Date;
  onSelect: (d: Date) => void;
}) {
  return (
    <div className="px-4 mb-4">
      <p className="text-[10px] font-semibold text-text3 uppercase tracking-widest mb-2">
        Date
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {days.map((d) => {
          const active = isSameDay(d, selected);
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelect(d)}
              className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              style={{
                backgroundColor: active ? getIntentColor("cta") : "var(--card2)",
                color:           active ? "#fff" : "var(--text2)",
              }}
            >
              {formatDayLabel(d)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SlotsGrid({
  slots,
  selected,
  onSelect,
}: {
  slots:    Slot[];
  selected: Slot | null;
  onSelect: (s: Slot) => void;
}) {
  if (slots.length === 0) {
    return (
      <div className="px-4 mb-4">
        <p className="text-xs text-text3 text-center py-4">
          Aucun créneau disponible ce jour.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 mb-4">
      <p className="text-[10px] font-semibold text-text3 uppercase tracking-widest mb-2">
        Créneau
        {slots.length === 1 && (
          <span
            className="ml-2 font-normal normal-case"
            style={{ color: getIntentColor("success") }}
          >
            ✓ sélectionné automatiquement
          </span>
        )}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {slots.map((slot) => {
          const isSelected = selected?.id === slot.id;
          const isDisabled = !slot.isAvailable;

          return (
            <button
              key={slot.id}
              type="button"
              disabled={isDisabled}
              onClick={isDisabled ? undefined : () => onSelect(slot)}
              className="h-10 rounded-xl text-xs font-semibold transition-all"
              style={{
                backgroundColor: isSelected
                  ? getIntentColor("cta")
                  : "var(--card2)",
                color: isSelected
                  ? "#fff"
                  : isDisabled
                  ? "#9CA3AF"
                  : "var(--text)",
                // disabled : opacity + line-through
                opacity:        isDisabled ? 0.4 : 1,
                textDecoration: isDisabled ? "line-through" : "none",
                cursor:         isDisabled ? "not-allowed" : "pointer",
              }}
            >
              {formatTime(slot.startsAt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────

export function BookingDrawer({ salon, isOpen, onClose, onSuccess }: BookingDrawerProps) {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate,    setSelectedDate]    = useState<Date>(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  });
  const [selectedSlot,    setSelectedSlot]    = useState<Slot | null>(null);

  // undefined = chargement | null = erreur réseau | SlotsData = succès
  const [slotsState, setSlotsState] = useState<SlotsData | null | undefined>(undefined);

  const { execute, status, error, reset } = useBookingAction();

  const days = getNext7Days();

  // ── SCROLL LOCK ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    lockScroll();
    return () => { unlockScroll(); };
  }, [isOpen]);

  // ── LOAD SLOTS ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const cached = getSlots(salon.id);
    if (cached !== undefined) {
      setSlotsState(cached);
    } else {
      setSlotsState(undefined);
    }

    preloadSlots(salon.id)
      .then((data) => { setSlotsState(data); })
      .catch(() => { setSlotsState(null); });
  }, [isOpen, salon.id]);

  // ── FILTER SLOTS BY DATE ─────────────────────────────────────
  // Non-calcul : simple filtre d'affichage sur données backend
  const dateSlots = (slotsState?.slots ?? []).filter((s) =>
    isSameDay(new Date(s.startsAt), selectedDate)
  );

  // ── AUTO-SELECT SI 1 SEUL CRÉNEAU ───────────────────────────
  useEffect(() => {
    if (dateSlots.length === 1 && dateSlots[0].isAvailable) {
      setSelectedSlot(dateSlots[0]);
    } else if (dateSlots.length !== 1) {
      // Reset seulement si pas déjà sélectionné sur cette date
      setSelectedSlot((prev) =>
        prev && dateSlots.some((s) => s.id === prev.id) ? prev : null
      );
    }
  }, [dateSlots.length, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SLOT_TAKEN RECOVERY ──────────────────────────────────────
  useEffect(() => {
    if (error?.code === "SLOT_TAKEN" && error.nextAvailableSlot) {
      const next = error.nextAvailableSlot;
      const nextDate = new Date(next.startsAt);
      nextDate.setHours(0, 0, 0, 0);
      // Sync date ET slot ensemble
      setSelectedDate(nextDate);
      setSelectedSlot(next);
    }
  }, [error]);

  // ── RESET ON CLOSE ───────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setSelectedSlot(null);
      setSelectedService(null);
      setSlotsState(undefined);
      reset();
    }
  }, [isOpen, reset]);

  // ── CONFIRM ──────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!selectedSlot || !selectedService) return;

    const user = getUser();

    const result = await execute({
      tenantId:  salon.id,
      serviceId: selectedService.id,
      slotId:    selectedSlot.id,
      phone:     user?.phone ?? undefined,
    });

    if (result) {
      // Invalider le cache du salon après réservation
      invalidateSlots(salon.id);
      onSuccess?.();
      onClose();
    }
  }, [selectedSlot, selectedService, salon.id, execute, onSuccess, onClose]);

  // ── RETRY SLOTS ──────────────────────────────────────────────
  const handleRetrySlots = useCallback(() => {
    setSlotsState(undefined);
    preloadSlots(salon.id)
      .then((data) => setSlotsState(data))
      .catch(() => setSlotsState(null));
  }, [salon.id]);

  // ── RENDER ────────────────────────────────────────────────────
  const canConfirm = !!selectedSlot && !!selectedService && status !== "loading";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION.duration.ui, ease: MOTION.easing }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Réserver chez ${salon.name}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: MOTION.duration.layout, ease: MOTION.easing }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-bg overflow-y-auto"
            style={{
              maxHeight:     "90dvh",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            {/* Drag indicator */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border2" />
            </div>

            {/* ── Header salon ──────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <h2 className="font-bold text-base text-text leading-tight">
                  {salon.name}
                </h2>
                <p className="text-xs text-text3">{salon.city}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-card2 text-text3 hover:text-text"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="pt-4">
              {/* ── Service picker ────────────────────────── */}
              <ServicePicker
                services={salon.services ?? []}
                selected={selectedService}
                onSelect={setSelectedService}
              />

              {/* ── Date picker ───────────────────────────── */}
              {selectedService && (
                <DatePicker
                  days={days}
                  selected={selectedDate}
                  onSelect={(d) => {
                    setSelectedDate(d);
                    setSelectedSlot(null);
                  }}
                />
              )}

              {/* ── Slots grid ────────────────────────────── */}
              {selectedService && (
                <div className="px-4 mb-4">
                  <p className="text-[10px] font-semibold text-text3 uppercase tracking-widest mb-2">
                    Créneaux
                  </p>

                  {/* Chargement */}
                  {slotsState === undefined && (
                    <SlotsSkeleton count={6} />
                  )}

                  {/* Erreur réseau — null = erreur (≠ zéro dispo) */}
                  {slotsState === null && (
                    <ErrorState type="network" onRetry={handleRetrySlots} />
                  )}

                  {/* Erreur métier depuis le booking */}
                  {status === "error" && error?.type === "business" && (
                    <ErrorState
                      type="business"
                      onRetry={() => { reset(); setSelectedSlot(null); }}
                    />
                  )}

                  {/* Slots disponibles */}
                  {slotsState !== null && slotsState !== undefined && (
                    <SlotsGrid
                      slots={dateSlots}
                      selected={selectedSlot}
                      onSelect={setSelectedSlot}
                    />
                  )}
                </div>
              )}

              {/* ── CTA ───────────────────────────────────── */}
              <div className="px-4 pb-6 pt-2">
                <BookingButton
                  status={status}
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  fullWidth
                />

                {/* 2e ligne : résumé sélection */}
                {selectedSlot && selectedService && (
                  <p className="text-center text-xs text-text3 mt-2">
                    {selectedService.name} · {selectedService.priceCents.toLocaleString("fr-FR")} FCFA
                    {" · "}
                    {formatTime(selectedSlot.startsAt)}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
