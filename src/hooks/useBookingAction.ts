"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { v4 as uuid } from "uuid";
import type { AsyncStatus } from "./useAsyncAction";

interface BookingPayload {
  tenantId:   string;
  serviceId:  string;
  slotId:     string;
  phone?:     string;
  note?:      string;
  paymentProvider?: string;
}

interface BookingResult {
  id:           string;
  status:       string;
  priceCents:   number;
  depositCents: number;
}

interface BookingError {
  code:    string;
  message: string;
  /** Créneau alternatif suggéré si SLOT_TAKEN */
  alternativeSlotId?: string;
}

export interface UseBookingActionResult {
  execute:    (payload: BookingPayload) => Promise<BookingResult | null>;
  status:     AsyncStatus;
  error:      BookingError | null;
  reset:      () => void;
  isIdle:     boolean;
  isLoading:  boolean;
  isSuccess:  boolean;
  isError:    boolean;
}

/**
 * useBookingAction — étend useAsyncAction pour les réservations.
 *
 * Protections additionnelles :
 * 1. AbortController : annule la requête précédente à chaque execute()
 *    Les AbortError sont ignorés silencieusement (pas d'état error)
 *
 * 2. Idempotency Key (RÈGLE CRITIQUE — NE PAS MODIFIER) :
 *    La clé NE SE RESET PAS sur erreur.
 *    Un retry doit envoyer la MÊME clé.
 *    Reset UNIQUEMENT après succès confirmé.
 *    Violer cette règle = double booking possible.
 *
 * 3. Gestion SLOT_TAKEN : message spécifique, conversion préservée.
 */
export function useBookingAction(): UseBookingActionResult {
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [error,  setError]  = useState<BookingError | null>(null);

  const mounted       = useRef(true);
  const timeoutsRef   = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const abortRef      = useRef<AbortController | null>(null);

  /**
   * Idempotency key — générée lazy au premier execute().
   * Survit aux retries. Reset uniquement après succès confirmé.
   */
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Annuler toute requête en vol lors du démontage
      abortRef.current?.abort();
      timeoutsRef.current.forEach((id) => clearTimeout(id));
      timeoutsRef.current.clear();
    };
  }, []);

  const safeSet = useCallback((update: () => void): void => {
    if (mounted.current) update();
  }, []);

  const safeTimeout = useCallback(
    (callback: () => void, delay: number) => {
      const id = setTimeout(() => {
        timeoutsRef.current.delete(id);
        if (mounted.current) callback();
      }, delay);
      timeoutsRef.current.add(id);
      return id;
    },
    [],
  );

  const reset = useCallback(() => {
    safeSet(() => { setStatus("idle"); setError(null); });
  }, [safeSet]);

  const execute = useCallback(
    async (payload: BookingPayload): Promise<BookingResult | null> => {
      if (status === "loading") return null;

      // Abort la requête précédente si encore en vol
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Génération lazy de la clé — survit aux retries
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = uuid();
      }
      const idempotencyKey = idempotencyKeyRef.current;

      safeSet(() => { setStatus("loading"); setError(null); });

      // Timeout de sécurité 10 s
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = safeTimeout(
          () => reject(new Error("TIMEOUT")),
          10_000,
        );
      });

      try {
        const fetchPromise = fetch("/api/bookings", {
          method:  "POST",
          headers: {
            "Content-Type":   "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          credentials: "include",
          signal: controller.signal,
          body:   JSON.stringify({ ...payload, idempotencyKey }),
        }).then(async (res) => {
          const json = await res.json();
          if (!res.ok) {
            const err: BookingError = {
              code:    json?.error?.code ?? "UNKNOWN",
              message: json?.error?.message ?? "Erreur inconnue.",
            };
            throw err;
          }
          return json.data as BookingResult;
        });

        const result = await Promise.race([fetchPromise, timeoutPromise]);

        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutsRef.current.delete(timeoutId);
        }

        safeSet(() => setStatus("success"));

        // Reset de la clé UNIQUEMENT après succès confirmé
        idempotencyKeyRef.current = null;

        // Soft success → retour idle après 1 200 ms
        safeTimeout(() => {
          setStatus((prev) => (prev === "success" ? "idle" : prev));
        }, 1_200);

        return result;

      } catch (err) {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutsRef.current.delete(timeoutId);
        }

        // AbortError = annulation volontaire — ignorer silencieusement
        if (err instanceof Error && err.name === "AbortError") {
          safeSet(() => setStatus("idle"));
          return null;
        }

        // Timeout
        if (err instanceof Error && err.message === "TIMEOUT") {
          safeSet(() => {
            setStatus("error");
            setError({ code: "TIMEOUT", message: "Délai dépassé. Réessayez." });
          });
          return null;
        }

        // Erreur métier (BookingError shape)
        const bookingErr = err as BookingError;
        const isSlotTaken = bookingErr?.code === "SLOT_TAKEN";

        safeSet(() => {
          setStatus("error");
          setError({
            code:    bookingErr?.code ?? "UNKNOWN",
            message: isSlotTaken
              ? "Ce créneau vient d'être pris. Choisissez un autre horaire."
              : (bookingErr?.message ?? "Réservation impossible. Réessayez."),
          });
        });

        // La clé idempotency NE SE RESET PAS ici (survit au retry)
        return null;
      }
    },
    [status, safeSet, safeTimeout],
  );

  return {
    execute,
    status,
    error,
    reset,
    isIdle:    status === "idle",
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError:   status === "error",
  };
}
