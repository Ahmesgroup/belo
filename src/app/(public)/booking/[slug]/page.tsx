"use client";

/**
 * Salon page — editorial beauty experience, NOT a checkout wizard.
 *
 * The atmosphere must match the homepage exactly :
 *   1. Hero  — full-bleed cinematic image with floating editorial text
 *   2. Soin  — beauty menu list (no boxes, no emoji icons)
 *   3. Moment — date strip + soft time slots
 *   4. Confirmation — quiet form + calm CTA
 *
 * RULES :
 * - No step bar, no progress dots, no wizard UI
 * - No emoji icons (💇‍♀️ 💅 etc.) — replaced by typography
 * - No green CTAs — green is reserved strictly for the final 'Confirmer'
 *   action (intent.ts cta). All other buttons are editorial underlines
 *   or warm-cream surfaces.
 * - Sections progressively reveal — soin first, moment after service is
 *   chosen, confirmation after slot. No 'Step 1 of 4' counters.
 * - Success state is poetic, not iconographic. No ✅ emoji.
 */

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { PublicNav } from "@/components/ui/Nav";
import { PhoneInput, buildFullPhone, splitPhone, COUNTRIES } from "@/components/ui/PhoneInput";
import { canUsePayment } from "@/lib/payment";
import { getIntentColor } from "@/lib/design/intent";

// ── TYPES ─────────────────────────────────────────────────────

type Service = { id: string; name: string; category: string; priceCents: number; durationMin: number; photos: string[] };
type Slot    = { id: string; startsAt: string; endsAt: string; isAvailable: boolean };
type Tenant  = {
  id:             string;
  name:           string;
  slug:           string;
  city:           string | null;
  plan:           string;
  coverUrl?:      string | null;
  photos?:        string[];
  depositEnabled: boolean;
  depositPercent: number;
  services:       Service[];
  _count?:        { bookings: number };
};

// ── HELPERS ───────────────────────────────────────────────────

function fmt(min: number): string {
  return min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}` : `${min} min`;
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function fmtPrice(p: number): string {
  return `${p.toLocaleString("fr-FR")} FCFA`;
}

function genDates() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return {
      day:     d.toLocaleDateString("fr-FR", { weekday: "short" }),
      num:     d.getDate(),
      monthLabel: d.toLocaleDateString("fr-FR", { month: "short" }),
      dateStr: d.toISOString().slice(0, 10),
    };
  });
}

// Category → editorial label (no emoji)
const CATEGORY_LABEL: Record<string, string> = {
  hair: "Coiffure",     HAIR: "Coiffure",
  nails: "Manucure",    NAILS: "Manucure",
  massage: "Massage",   MASSAGE: "Massage",
  barber: "Barbier",    BARBER: "Barbier",
  spa: "Spa",           SPA: "Spa",
  beauty: "Soin",       BEAUTY: "Soin",
  makeup: "Maquillage", MAKEUP: "Maquillage",
  waxing: "Épilation",  WAXING: "Épilation",
  eyelash: "Cils",      EYELASH: "Cils",
  other: "Autre",       OTHER: "Autre",
};
const categoryOf = (cat: string) => CATEGORY_LABEL[cat] ?? "Soin";

// ── PAGE ──────────────────────────────────────────────────────

export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const dates = genDates();

  const [tenant,       setTenant]       = useState<Tenant | null>(null);
  const [loadErr,      setLoadErr]      = useState("");
  const [slots,        setSlots]        = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [svc,         setSvc]         = useState<Service | null>(null);
  const [slot,        setSlot]        = useState<Slot | null>(null);
  const [dateStr,     setDateStr]     = useState(dates[0].dateStr);
  const [countryCode, setCountryCode] = useState("221");
  const [phone,       setPhone]       = useState("");
  const [note,        setNote]        = useState("");
  const [payMethod,   setPayMethod]   = useState("wave");
  const [booking,     setBooking]     = useState(false);
  const [bookingErr,  setBookingErr]  = useState("");
  const [done,        setDone]        = useState(false);
  const [bookingRef,  setBookingRef]  = useState("");

  // Pre-fill phone from saved user profile (client-only)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("belo_user") ?? "{}");
      if (saved.phone) {
        const { countryCode: cc, local } = splitPhone(saved.phone);
        setCountryCode(cc);
        setPhone(local);
      }
    } catch { /* ignore */ }
  }, []);

  // Load tenant + services (5 s timeout)
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    fetch(`/api/tenants/${slug}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (d.data) setTenant(d.data);
        else if (d.error?.code === "NOT_FOUND") setLoadErr("Ce salon n'existe pas ou n'est plus disponible.");
        else setLoadErr("Impossible de charger ce salon. Réessayez.");
      })
      .catch(err => {
        if (err.name === "AbortError") setLoadErr("Chargement trop long. Vérifiez votre connexion.");
        else setLoadErr("Erreur de connexion. Réessayez.");
      })
      .finally(() => clearTimeout(timer));
    return () => { controller.abort(); clearTimeout(timer); };
  }, [slug]);

  // Fetch available slots when service or date changes
  const tenantId = tenant?.id ?? null;
  const svcId    = svc?.id    ?? null;

  useEffect(() => {
    if (!tenantId || !svcId) return;
    const controller = new AbortController();
    setSlotsLoading(true);
    setSlot(null);
    fetch(`/api/slots?tenantId=${tenantId}&serviceId=${svcId}&date=${dateStr}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => setSlots(d.data?.slots ?? []))
      .catch(err => { if (err.name !== "AbortError") setSlots([]); })
      .finally(() => setSlotsLoading(false));
    return () => controller.abort();
  }, [tenantId, svcId, dateStr]);

  const paymentEnabled = canUsePayment(tenant);
  const deposit = svc && tenant ? Math.round(svc.priceCents * (tenant.depositPercent / 100)) : 0;

  const grouped = {
    morning:   slots.filter(s => new Date(s.startsAt).getUTCHours() < 12),
    afternoon: slots.filter(s => { const h = new Date(s.startsAt).getUTCHours(); return h >= 12 && h < 17; }),
    evening:   slots.filter(s => new Date(s.startsAt).getUTCHours() >= 17),
  };

  async function confirmBooking() {
    if (!tenant || !svc || !slot) return;
    const token = localStorage.getItem("belo_token");
    if (!token) { window.location.href = `/login?redirect=/booking/${slug}`; return; }

    setBooking(true); setBookingErr("");
    try {
      const providerMap: Record<string, string> = { wave: "wave", orange: "orange_money", stripe: "stripe" };
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          serviceId:       svc.id,
          slotId:          slot.id,
          tenantId:        tenant.id,
          clientNote:      note || undefined,
          paymentProvider: paymentEnabled ? (providerMap[payMethod] ?? "wave") : "wave",
          idempotencyKey:  crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setBookingErr(data.error?.message || "Réservation impossible."); return; }
      setBookingRef(data.data?.id ?? "");
      setDone(true);
      // Smooth scroll to top after success
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
    } catch { setBookingErr("Connexion interrompue. Réessayez."); }
    finally { setBooking(false); }
  }

  // ── ERROR STATE — calm, no warning emoji ──────────────────
  if (loadErr) return (
    <>
      <PublicNav />
      <main style={{ paddingTop: 56, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <h1 style={{ fontFamily: "var(--font-fraunces, var(--serif))", fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 12, letterSpacing: "-0.01em" }}>
            {loadErr}
          </h1>
          <Link
            href="/salons"
            style={{
              fontFamily:          "var(--font-fraunces, var(--serif))",
              fontWeight:          500,
              fontSize:            13,
              color:               "var(--text)",
              textDecoration:      "underline",
              textUnderlineOffset: 4,
            }}
          >
            ← Retour aux salons
          </Link>
        </div>
      </main>
    </>
  );

  // ── LOADING STATE — quiet text ────────────────────────────
  if (!tenant) return (
    <>
      <PublicNav />
      <main style={{ paddingTop: 56, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 13, color: "var(--warm-mute)" }}>Chargement…</p>
      </main>
    </>
  );

  // ── SUCCESS STATE — editorial poetry, no ✅ ──────────────
  if (done && svc && slot) return (
    <>
      <PublicNav />
      <main style={{ paddingTop: 80, paddingBottom: 80, maxWidth: 560, margin: "0 auto", padding: "80px 24px" }}>
        <p style={{ fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--warm-mute)", marginBottom: 16, textAlign: "center" }}>
          Réservation confirmée
        </p>
        <h1 style={{ fontFamily: "var(--font-fraunces, var(--serif))", fontSize: "clamp(2rem, 5vw, 2.75rem)", fontWeight: 600, color: "var(--text)", lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 24, textAlign: "center" }}>
          À très bientôt.
        </h1>
        <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.7, textAlign: "center", marginBottom: 40, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
          Nous avons envoyé votre confirmation par WhatsApp au {buildFullPhone(countryCode, phone)}.{" "}
          {tenant.name} vous attend.
        </p>

        {/* Receipt — hairline composition, no border-box */}
        <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "24px 0", marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--warm-mute)" }}>Soin</span>
            <span style={{ fontFamily: "var(--font-fraunces, var(--serif))", fontWeight: 500, fontSize: 14, color: "var(--text)" }}>{svc.name}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--warm-mute)" }}>Date</span>
            <span style={{ fontFamily: "var(--font-fraunces, var(--serif))", fontWeight: 500, fontSize: 14, color: "var(--text)" }}>
              {new Date(slot.startsAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--warm-mute)" }}>Heure</span>
            <span style={{ fontFamily: "var(--font-fraunces, var(--serif))", fontWeight: 500, fontSize: 14, color: "var(--text)" }}>{fmtTime(slot.startsAt)}</span>
          </div>
          {bookingRef && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12 }}>
              <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--warm-mute)" }}>Référence</span>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--warm-mute)" }}>{bookingRef.slice(0, 12)}</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/profil"
            style={{
              fontFamily:          "var(--font-fraunces, var(--serif))",
              fontWeight:          500,
              fontSize:            13,
              color:               "var(--text)",
              textDecoration:      "underline",
              textUnderlineOffset: 4,
            }}
          >
            Mes réservations
          </Link>
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-fraunces, var(--serif))",
              fontWeight: 500,
              fontSize:   13,
              color:      "var(--warm-mute)",
            }}
          >
            Retour à l'accueil
          </Link>
        </div>
      </main>
    </>
  );

  // ── MAIN — editorial salon experience ─────────────────────

  const primaryImage = tenant.coverUrl || tenant.photos?.[0] || null;
  const category     = tenant.services[0]?.category ?? "";

  return (
    <>
      <PublicNav />

      <main>
        {/* ────────────────────────────────────────────────────
            HERO — full-bleed cinematic, floating editorial text
            ──────────────────────────────────────────────────── */}
        <section
          className="beauty-photo"
          style={{
            position:   "relative",
            width:      "100%",
            height:     "min(72vh, 620px)",
            minHeight:  420,
            overflow:   "hidden",
            background: "var(--card2)",
          }}
        >
          {primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryImage}
              alt={tenant.name}
              style={{
                position:   "absolute",
                inset:      0,
                width:      "100%",
                height:     "100%",
                objectFit:  "cover",
              }}
            />
          ) : (
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, var(--warm-cream), var(--blush))" }} />
          )}

          {/* Gradient overlay — subtle, only for text legibility */}
          <div
            style={{
              position: "absolute",
              inset:    0,
              background: "linear-gradient(to bottom, rgba(0,0,0,.10) 0%, transparent 30%, rgba(0,0,0,.55) 100%)",
              pointerEvents: "none",
            }}
            aria-hidden="true"
          />

          {/* Back link — discrete, top-left */}
          <Link
            href="/salons"
            style={{
              position:            "absolute",
              top:                 80,
              left:                24,
              fontFamily:          "var(--font-fraunces, var(--serif))",
              fontSize:            12,
              fontWeight:          500,
              color:               "rgba(255,255,255,.85)",
              textDecoration:      "none",
              textShadow:          "0 1px 2px rgba(0,0,0,.4)",
            }}
          >
            ← Salons
          </Link>

          {/* Floating editorial credit — bottom of hero */}
          <div
            style={{
              position: "absolute",
              bottom:   0,
              left:     0,
              right:    0,
              padding:  "32px 24px 40px",
              color:    "#fff",
            }}
          >
            <p
              style={{
                fontSize:       10,
                letterSpacing:  "0.3em",
                textTransform:  "uppercase",
                color:          "rgba(255,255,255,.85)",
                marginBottom:   14,
                textShadow:     "0 1px 2px rgba(0,0,0,.3)",
              }}
            >
              {tenant.city ? `${tenant.city} · ` : ""}{categoryOf(category)}
            </p>
            <h1
              style={{
                fontFamily:    "var(--font-fraunces, var(--serif))",
                fontSize:      "clamp(2.25rem, 6vw, 3.75rem)",
                fontWeight:    600,
                lineHeight:    1.05,
                letterSpacing: "-0.02em",
                color:         "#fff",
                marginBottom:  16,
                textShadow:    "0 2px 8px rgba(0,0,0,.25)",
                maxWidth:      640,
              }}
            >
              {tenant.name}
            </h1>
            <p
              style={{
                fontSize:    13,
                color:       "rgba(255,255,255,.82)",
                letterSpacing: "0.04em",
                textShadow:  "0 1px 2px rgba(0,0,0,.3)",
              }}
            >
              {(tenant._count?.bookings ?? 0) > 5 ? "4.8 ★ · " : ""}
              Confirmation WhatsApp instantanée
            </p>
          </div>
        </section>

        {/* ────────────────────────────────────────────────────
            EDITORIAL BODY — sections progressively reveal
            ──────────────────────────────────────────────────── */}
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "56px 24px 80px" }}>

          {/* ── SOIN — beauty menu ──────────────────────────── */}
          <section style={{ marginBottom: svc ? 64 : 40 }}>
            <p
              style={{
                fontSize:       10,
                letterSpacing:  "0.3em",
                textTransform:  "uppercase",
                color:          "var(--warm-mute)",
                marginBottom:   12,
              }}
            >
              Le soin
            </p>
            <h2
              style={{
                fontFamily:    "var(--font-fraunces, var(--serif))",
                fontSize:      "clamp(1.75rem, 4vw, 2.25rem)",
                fontWeight:    600,
                color:         "var(--text)",
                letterSpacing: "-0.015em",
                lineHeight:    1.15,
                marginBottom:  32,
              }}
            >
              Choisissez votre rituel
            </h2>

            {tenant.services.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.7 }}>
                Ce salon n'a pas encore ajouté ses soins. Revenez bientôt.
              </p>
            ) : (
              <div>
                {tenant.services.map((s, i) => {
                  const active  = svc?.id === s.id;
                  const isFirst = i === 0;
                  return (
                    <article
                      key={s.id}
                      onClick={() => setSvc(s)}
                      style={{
                        display:        "flex",
                        alignItems:     "baseline",
                        gap:            16,
                        padding:        "22px 0",
                        cursor:         "pointer",
                        borderTop:      isFirst ? "1px solid var(--border)" : "none",
                        borderBottom:   "1px solid var(--border)",
                        borderLeft:     active ? "2px solid var(--text)" : "2px solid transparent",
                        paddingLeft:    active ? 18 : 0,
                        transition:     "padding-left 320ms cubic-bezier(0.22, 1, 0.36, 1), border-color 320ms",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontFamily:    "var(--font-fraunces, var(--serif))",
                            fontWeight:    500,
                            fontSize:      17,
                            color:         "var(--text)",
                            letterSpacing: "-0.005em",
                            marginBottom:  4,
                          }}
                        >
                          {s.name}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--warm-mute)" }}>
                          {fmt(s.durationMin)} · {categoryOf(s.category)}
                        </p>
                      </div>
                      <p
                        style={{
                          fontFamily: "var(--font-fraunces, var(--serif))",
                          fontWeight: 500,
                          fontSize:   16,
                          color:      "var(--text)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmtPrice(s.priceCents)}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── MOMENT — only after a service is chosen ─────── */}
          {svc && (
            <section
              style={{
                marginBottom: slot ? 64 : 40,
                animation:    "fadeReveal 700ms cubic-bezier(0.22, 1, 0.36, 1) both",
              }}
            >
              <p style={{ fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--warm-mute)", marginBottom: 12 }}>
                Le moment
              </p>
              <h2 style={{ fontFamily: "var(--font-fraunces, var(--serif))", fontSize: "clamp(1.75rem, 4vw, 2.25rem)", fontWeight: 600, color: "var(--text)", letterSpacing: "-0.015em", lineHeight: 1.15, marginBottom: 32 }}>
                Choisissez votre créneau
              </h2>

              {/* Date strip — soft warm-cream buttons */}
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 32, scrollbarWidth: "none" }}>
                {dates.map(d => {
                  const active = dateStr === d.dateStr;
                  return (
                    <button
                      key={d.dateStr}
                      type="button"
                      onClick={() => setDateStr(d.dateStr)}
                      style={{
                        flexShrink:     0,
                        width:          64,
                        padding:        "12px 0",
                        textAlign:      "center",
                        background:     active ? "var(--text)" : "var(--warm-cream)",
                        color:          active ? "var(--cream)" : "var(--text2)",
                        border:         "none",
                        borderRadius:   16,
                        cursor:         "pointer",
                        transition:     "background 320ms cubic-bezier(0.22, 1, 0.36, 1), color 320ms",
                      }}
                    >
                      <p style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4, opacity: 0.75 }}>
                        {d.day}
                      </p>
                      <p style={{ fontFamily: "var(--font-fraunces, var(--serif))", fontSize: 20, fontWeight: 500, lineHeight: 1 }}>
                        {d.num}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Slots */}
              {slotsLoading && (
                <p style={{ fontSize: 13, color: "var(--warm-mute)", padding: "20px 0" }}>Recherche des créneaux…</p>
              )}

              {!slotsLoading && slots.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--text2)", padding: "20px 0", lineHeight: 1.7 }}>
                  Aucun créneau ce jour. Essayez une autre date.
                </p>
              )}

              {!slotsLoading && ([["Matin", grouped.morning], ["Après-midi", grouped.afternoon], ["Soir", grouped.evening]] as const).map(([label, group]) => (
                group.length > 0 && (
                  <div key={label} style={{ marginBottom: 28 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      <p style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--warm-mute)" }}>
                        {label}
                      </p>
                      <div style={{ flex: 1, height: 1, background: "var(--border)" }} aria-hidden="true" />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {group.map(s => {
                        const active = slot?.id === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSlot(s)}
                            style={{
                              padding:        "10px 18px",
                              borderRadius:   99,
                              background:     active ? "var(--text)" : "transparent",
                              color:          active ? "var(--cream)" : "var(--text2)",
                              border:         active ? "1px solid var(--text)" : "1px solid var(--border2)",
                              fontFamily:     "var(--font-fraunces, var(--serif))",
                              fontSize:       13,
                              fontWeight:     500,
                              cursor:         "pointer",
                              transition:     "background 320ms cubic-bezier(0.22, 1, 0.36, 1), color 320ms, border-color 320ms",
                            }}
                          >
                            {fmtTime(s.startsAt)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              ))}
            </section>
          )}

          {/* ── CONFIRMATION — only after a slot is chosen ──── */}
          {svc && slot && (
            <section style={{ animation: "fadeReveal 700ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
              <p style={{ fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--warm-mute)", marginBottom: 12 }}>
                Confirmation
              </p>
              <h2 style={{ fontFamily: "var(--font-fraunces, var(--serif))", fontSize: "clamp(1.75rem, 4vw, 2.25rem)", fontWeight: 600, color: "var(--text)", letterSpacing: "-0.015em", lineHeight: 1.15, marginBottom: 32 }}>
                Vos coordonnées
              </h2>

              {/* Soft summary — hairline composition */}
              <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "20px 0", marginBottom: 32 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--warm-mute)" }}>Soin</span>
                  <span style={{ fontFamily: "var(--font-fraunces, var(--serif))", fontWeight: 500, fontSize: 14, color: "var(--text)" }}>{svc.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--warm-mute)" }}>Moment</span>
                  <span style={{ fontFamily: "var(--font-fraunces, var(--serif))", fontWeight: 500, fontSize: 14, color: "var(--text)" }}>
                    {new Date(slot.startsAt).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {fmtTime(slot.startsAt)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--warm-mute)" }}>Tarif</span>
                  <span style={{ fontFamily: "var(--font-fraunces, var(--serif))", fontWeight: 500, fontSize: 14, color: "var(--text)" }}>
                    {fmtPrice(svc.priceCents)}
                    {paymentEnabled && <span style={{ color: "var(--warm-mute)", marginLeft: 8, fontWeight: 400 }}>· Acompte {fmtPrice(deposit)}</span>}
                  </span>
                </div>
              </div>

              {/* Phone */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--warm-mute)", marginBottom: 10 }}>
                  Votre WhatsApp
                </p>
                <PhoneInput
                  countryISO={COUNTRIES.find(c => c.dial === countryCode)?.iso ?? "SN"}
                  localNumber={phone}
                  onCountryChange={c => setCountryCode(c.dial)}
                  onNumberChange={setPhone}
                />
              </div>

              {/* Optional note */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--warm-mute)", marginBottom: 10 }}>
                  Précisions (optionnel)
                </p>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Une attention particulière, une préférence…"
                  rows={2}
                  style={{ resize: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Payment methods — only when applicable */}
              {paymentEnabled ? (
                <div style={{ marginBottom: 32 }}>
                  <p style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--warm-mute)", marginBottom: 14 }}>
                    Mode de paiement de l&apos;acompte
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{ id: "wave", label: "Wave" }, { id: "orange", label: "Orange Money" }, { id: "stripe", label: "Carte" }].map(p => {
                      const active = payMethod === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPayMethod(p.id)}
                          style={{
                            flex:           1,
                            padding:        "14px 12px",
                            background:     active ? "var(--text)" : "var(--warm-cream)",
                            color:          active ? "var(--cream)" : "var(--text2)",
                            border:         "none",
                            borderRadius:   16,
                            fontFamily:     "var(--font-fraunces, var(--serif))",
                            fontSize:       13,
                            fontWeight:     500,
                            cursor:         "pointer",
                            transition:     "background 320ms cubic-bezier(0.22, 1, 0.36, 1), color 320ms",
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.7, marginBottom: 32 }}>
                  Paiement directement en salon — aucun acompte requis.
                </p>
              )}

              {/* Error message — quiet sentence */}
              {bookingErr && (
                <p style={{ fontSize: 12, color: "var(--text)", marginBottom: 16, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  {bookingErr}
                </p>
              )}

              {/* CTA — the ONE green moment on this page, intent.ts cta */}
              <button
                type="button"
                onClick={confirmBooking}
                disabled={!phone || booking}
                style={{
                  width:          "100%",
                  padding:        "16px 24px",
                  border:         "none",
                  borderRadius:   20,
                  fontFamily:     "var(--font-fraunces, var(--serif))",
                  fontWeight:     500,
                  fontSize:       15,
                  letterSpacing:  "0.01em",
                  background:     (!phone || booking) ? "var(--card2)" : getIntentColor("cta"),
                  color:          (!phone || booking) ? "var(--warm-mute)" : "#fff",
                  cursor:         (!phone || booking) ? "not-allowed" : "pointer",
                  transition:     "background 320ms cubic-bezier(0.22, 1, 0.36, 1), color 320ms",
                  opacity:        (!phone || booking) ? 0.85 : 0.95,
                }}
              >
                {booking
                  ? "Réservation en cours…"
                  : paymentEnabled
                    ? `Confirmer · ${fmtPrice(deposit)}`
                    : "Confirmer la réservation"}
              </button>
            </section>
          )}
        </div>

        {/* Animation keyframe — soft progressive reveal */}
        <style>{`
          @keyframes fadeReveal {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </main>
    </>
  );
}
