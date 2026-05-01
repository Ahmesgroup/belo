"use client";
import { useState, useCallback } from "react";
import { v4 as uuid } from "uuid";

interface BookingState {
  serviceId: string | null;
  slotId:    string | null;
  phone:     string;
  note:      string;
  provider:  "wave" | "orange_money" | "stripe";
  idempotencyKey: string;
}

export function useBooking(tenantId: string) {
  const [state, setState] = useState<BookingState>({
    serviceId: null, slotId: null, phone: "", note: "",
    provider: "wave", idempotencyKey: uuid(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const selectService = useCallback((id: string) => setState(s => ({ ...s, serviceId: id })), []);
  const selectSlot    = useCallback((id: string) => setState(s => ({ ...s, slotId: id })),    []);
  const setPhone      = useCallback((p: string)  => setState(s => ({ ...s, phone: p })),       []);
  const setProvider   = useCallback((p: "wave"|"orange_money"|"stripe") => setState(s => ({ ...s, provider: p })), []);

  const createBooking = useCallback(async () => {
    if (!state.serviceId || !state.slotId) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, ...state }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Erreur");
      return data.data;
    } catch(e) {
      setError(e instanceof Error ? e.message : "Erreur");
      return null;
    } finally {
      setLoading(false);
    }
  }, [state, tenantId]);

  return { state, selectService, selectSlot, setPhone, setProvider, createBooking, loading, error };
}
