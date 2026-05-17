"use client";

/**
 * Réservations — calm beauty agenda, not a CRM.
 *
 * The bookings page is the daily workspace. It must feel like a
 * paper agenda in a quiet atelier, not a Stripe payments table.
 *
 * RULES :
 * - No emojis (📅 ✅ ❌ 🚀 etc.)
 * - No alarming amber pulses, no red urgent badges
 * - Pending state = subtle hairline left-border + uppercase tracked label
 * - Status tones are warm-mute by default, soft text for action
 * - Toasts are quiet text confirmations, no border-shadow alerts
 * - Sections melt — no hard borders between list rows, only hairlines
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getUser, authHeaders, jsonAuthHeaders } from "@/lib/auth-client";

// ── TYPES ─────────────────────────────────────────────────────

type Booking = {
  id:        string;
  status:    string;
  createdAt: string;
  service?:  { name: string; priceCents: number };
  slot?:     { startsAt: string };
};

type Toast = { id: number; msg: string; ok: boolean };

// ── STATUS — calm taxonomy (matches dashboard main page) ──────

const STATUS_LABEL: Record<string, string> = {
  PENDING:   "En attente",
  CONFIRMED: "Confirmée",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
  NO_SHOW:   "Absente",
};

const STATUS_TONE: Record<string, string> = {
  PENDING:   "var(--text)",        // demands attention — but text color, not alarming
  CONFIRMED: "var(--warm-mute)",
  COMPLETED: "var(--warm-mute)",
  CANCELLED: "var(--warm-mute)",
  NO_SHOW:   "var(--warm-mute)",
};

// ── HELPERS ───────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day:     "numeric",
    month:   "short",
    hour:    "2-digit",
    minute:  "2-digit",
  });
}

// ── COMPONENT ─────────────────────────────────────────────────

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [toasts,   setToasts]   = useState<Toast[]>([]);

  function addToast(msg: string, ok = true) {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, ok }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }

  const loadBookings = useCallback(() => {
    const user = getUser();
    if (!user?.tenantId) { setLoading(false); return; }
    fetch(`/api/bookings?tenantId=${user.tenantId}&pageSize=50`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.data?.bookings) setBookings(d.data.bookings);
        else                  setError(d.error?.message ?? "Chargement impossible.");
      })
      .catch(() => setError("Connexion interrompue."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  useEffect(() => {
    window.addEventListener("tenant-updated", loadBookings);
    return () => window.removeEventListener("tenant-updated", loadBookings);
  }, [loadBookings]);

  async function updateStatus(bookingId: string, status: "CONFIRMED" | "CANCELLED") {
    setUpdating(bookingId);
    try {
      const res = await fetch("/api/bookings", {
        method:  "PATCH",
        headers: jsonAuthHeaders(),
        body:    JSON.stringify({ bookingId, status }),
      });
      const d = await res.json();
      if (res.ok) {
        setBookings(prev => prev.map(b =>
          b.id === bookingId ? { ...b, status: d.data.booking.status } : b
        ));
        addToast(
          status === "CONFIRMED" ? "Réservation acceptée." : "Réservation refusée.",
          status === "CONFIRMED",
        );
        window.dispatchEvent(new Event("tenant-updated"));
        loadBookings();
      } else {
        addToast(d.error?.message ?? "Action impossible.", false);
      }
    } catch {
      addToast("Connexion interrompue.", false);
    } finally {
      setUpdating(null);
    }
  }

  const pendingCount = bookings.filter(b => b.status === "PENDING").length;

  return (
    <div style={{ padding: "44px 28px 64px", maxWidth: 760, margin: "0 auto" }}>

      {/* ── Toast — calm text confirmation ─────────────────── */}
      <div
        className="dashboard-toast-stack"
        style={{
          position:   "fixed",
          bottom:     20,
          right:      20,
          left:       20,
          zIndex:     1000,
          display:    "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap:        8,
          pointerEvents: "none",
        }}
      >
        {toasts.map(t => (
          <div
            key={t.id}
            style={{
              background:     "var(--card)",
              padding:        "12px 18px",
              fontSize:       13,
              maxWidth:       320,
              boxShadow:      "0 8px 30px rgba(36,28,24,.06)",
              pointerEvents:  "all",
              color:          "var(--text)",
              fontFamily:     "var(--font-fraunces, var(--serif))",
              fontWeight:     500,
              borderRadius:   16,
              borderTop:      `1px solid ${t.ok ? "var(--border)" : "var(--border2)"}`,
              opacity:        0.95,
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>

      {/* ── Eyebrow + heading — editorial ──────────────────── */}
      <p
        style={{
          fontSize:       10,
          letterSpacing:  "0.28em",
          textTransform:  "uppercase",
          color:          "var(--warm-mute)",
          marginBottom:   12,
        }}
      >
        Atelier
      </p>

      <h1
        style={{
          fontFamily:    "var(--font-fraunces, var(--serif))",
          fontSize:      "clamp(2rem, 5vw, 2.75rem)",
          fontWeight:    600,
          letterSpacing: "-0.02em",
          lineHeight:    1.1,
          color:         "var(--text)",
          marginBottom:  10,
        }}
      >
        Réservations
      </h1>

      {/* Pending count — calm sentence, never a colored pill */}
      <p
        style={{
          fontSize:    15,
          color:       "var(--text2)",
          lineHeight:  1.7,
          maxWidth:    520,
          marginBottom: 40,
        }}
      >
        {loading
          ? "Chargement de votre carnet…"
          : pendingCount === 0
            ? bookings.length === 0
              ? "Votre carnet est encore vide."
              : "Toutes vos réservations sont à jour."
            : pendingCount === 1
              ? "Une réservation attend votre réponse."
              : `${pendingCount} réservations attendent votre réponse.`}
      </p>

      {/* Inline action — soft link, never a green pill */}
      <Link
        href="/dashboard/horaires"
        style={{
          fontSize:            13,
          color:               "var(--text)",
          textDecoration:      "underline",
          textUnderlineOffset: 4,
          fontFamily:          "var(--font-fraunces, var(--serif))",
          fontWeight:          500,
          display:             "inline-block",
          marginBottom:        48,
        }}
      >
        Ouvrir des créneaux
      </Link>

      {/* ── Loading — quiet text ───────────────────────────── */}
      {loading && (
        <p style={{ fontSize: 13, color: "var(--warm-mute)" }}>Chargement…</p>
      )}

      {/* ── Error — calm sentence + soft retry ─────────────── */}
      {!loading && error && (
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>
            {error}
          </p>
          <button
            type="button"
            onClick={loadBookings}
            style={{
              fontSize:            13,
              color:               "var(--text)",
              background:          "transparent",
              border:              "none",
              cursor:              "pointer",
              padding:             0,
              textDecoration:      "underline",
              textUnderlineOffset: 4,
              fontFamily:          "var(--font-fraunces, var(--serif))",
              fontWeight:          500,
            }}
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ── Empty state — poetry, not iconography ──────────── */}
      {!loading && !error && bookings.length === 0 && (
        <div style={{ paddingTop: 20, paddingBottom: 60 }}>
          <p
            style={{
              fontFamily:     "var(--font-fraunces, var(--serif))",
              fontWeight:     500,
              fontSize:       18,
              color:          "var(--text)",
              lineHeight:     1.4,
              maxWidth:       420,
              marginBottom:   14,
              letterSpacing:  "-0.01em",
            }}
          >
            Vos prochaines clientes apparaîtront ici dès qu'elles auront réservé.
          </p>
          <p
            style={{
              fontSize:    13,
              color:       "var(--text2)",
              lineHeight:  1.7,
              maxWidth:    420,
              marginBottom: 24,
            }}
          >
            Commencez par ouvrir des créneaux et ajouter vos soins. Belo s'occupe du reste.
          </p>
          <Link
            href="/dashboard/horaires"
            style={{
              fontSize:            13,
              color:               "var(--text)",
              textDecoration:      "underline",
              textUnderlineOffset: 4,
              fontFamily:          "var(--font-fraunces, var(--serif))",
              fontWeight:          500,
            }}
          >
            Ouvrir mes créneaux
          </Link>
        </div>
      )}

      {/* ── List — hairline rhythm ─────────────────────────── */}
      {!loading && !error && bookings.length > 0 && (
        <div>
          {bookings.map((b, i) => {
            const isPending = b.status === "PENDING";
            const isFirst   = i === 0;
            return (
              <article
                key={b.id}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            16,
                  padding:        "20px 0 20px 18px",
                  borderTop:      isFirst ? "1px solid var(--border)" : "none",
                  borderBottom:   "1px solid var(--border)",
                  borderLeft:     isPending
                                    ? "2px solid var(--text)"
                                    : "2px solid transparent",
                  opacity:        updating === b.id ? 0.55 : 1,
                  transition:     "opacity 320ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                {/* Initial — soft warm-cream circle, no purple gradient */}
                <div
                  style={{
                    width:           36,
                    height:          36,
                    borderRadius:    99,
                    background:      "var(--warm-cream)",
                    color:           "var(--text)",
                    display:         "flex",
                    alignItems:      "center",
                    justifyContent:  "center",
                    fontFamily:      "var(--font-fraunces, var(--serif))",
                    fontWeight:      500,
                    fontSize:        14,
                    flexShrink:      0,
                  }}
                  aria-hidden="true"
                >
                  {(b.service?.name?.[0] ?? "R").toUpperCase()}
                </div>

                {/* Service + time */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontFamily:    "var(--font-fraunces, var(--serif))",
                      fontWeight:    500,
                      fontSize:      16,
                      color:         "var(--text)",
                      letterSpacing: "-0.005em",
                      marginBottom:  3,
                      overflow:      "hidden",
                      textOverflow:  "ellipsis",
                      whiteSpace:    "nowrap",
                    }}
                  >
                    {b.service?.name ?? "Réservation"}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--warm-mute)" }}>
                    {b.slot?.startsAt ? fmtDate(b.slot.startsAt) : fmtDate(b.createdAt)}
                  </p>
                </div>

                {/* Price — Fraunces, never alarming green */}
                {b.service?.priceCents !== undefined && b.service.priceCents > 0 && (
                  <p
                    style={{
                      fontFamily: "var(--font-fraunces, var(--serif))",
                      fontWeight: 500,
                      fontSize:   14,
                      color:      "var(--text2)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {b.service.priceCents.toLocaleString("fr-FR")} F
                  </p>
                )}

                {/* Actions (only on pending) — calm underlined text */}
                {isPending && (
                  <div
                    className="dashboard-booking-actions"
                    style={{ display: "flex", gap: 16, flexShrink: 0 }}
                  >
                    <button
                      type="button"
                      disabled={updating === b.id}
                      onClick={() => updateStatus(b.id, "CONFIRMED")}
                      style={{
                        fontSize:            13,
                        fontFamily:          "var(--font-fraunces, var(--serif))",
                        fontWeight:          500,
                        background:          "transparent",
                        border:              "none",
                        cursor:              "pointer",
                        color:               "var(--text)",
                        textDecoration:      "underline",
                        textUnderlineOffset: 4,
                        padding:             "4px 0",
                      }}
                    >
                      Accepter
                    </button>
                    <button
                      type="button"
                      disabled={updating === b.id}
                      onClick={() => updateStatus(b.id, "CANCELLED")}
                      style={{
                        fontSize:   13,
                        fontFamily: "var(--font-fraunces, var(--serif))",
                        fontWeight: 500,
                        background: "transparent",
                        border:     "none",
                        cursor:     "pointer",
                        color:      "var(--warm-mute)",
                        padding:    "4px 0",
                      }}
                    >
                      Refuser
                    </button>
                  </div>
                )}

                {/* Status — uppercase tracked credit, never colored pill */}
                {!isPending && (
                  <p
                    style={{
                      fontSize:      10,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color:         STATUS_TONE[b.status] ?? "var(--warm-mute)",
                      minWidth:      78,
                      textAlign:     "right",
                      flexShrink:    0,
                    }}
                  >
                    {STATUS_LABEL[b.status] ?? b.status}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
