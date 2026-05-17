"use client";

/**
 * Dashboard — Beauty workspace, not admin software.
 *
 * RULES :
 * - No visible card borders, no boxed widgets, no harsh shadows
 * - Sections melt together via spacing only
 * - Metrics feel supportive, never stressful
 * - Calm hierarchy : Fraunces editorial + warm typography
 * - No emojis (⚠️ 🚀 ✦ ✓ etc.) — line-art SVG or pure type
 *
 * "Composed, not assembled. Editorial workspace, not widget dashboard."
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { getUser, authHeaders } from "@/lib/auth-client";

// ── TYPES ─────────────────────────────────────────────────────

type Booking = {
  id:        string;
  status:    string;
  createdAt: string;
  service?:  { name: string; priceCents: number };
  slot?:     { startsAt: string };
};

type TenantData = {
  plan:              string;
  phone?:            string | null;
  bookingsUsedMonth: number;
  horaires?:         Array<{ open: boolean; from: string; to: string }> | null;
  name?:             string;
};

type ServiceItem = { id: string; name: string };

// ── HELPERS ───────────────────────────────────────────────────

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bel après-midi";
  return "Belle soirée";
}

function formatTodayLong(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
  });
}

// ── ICONS (line-art, never emojis) ───────────────────────────

function CheckMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="m2.5 6.2 2.4 2.4 5-5" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

// ── STATUS — calm taxonomy ────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING:   "En attente",
  CONFIRMED: "Confirmée",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
  NO_SHOW:   "Absente",
};

// Hairline color cues, never alarming saturation
const STATUS_TONE: Record<string, string> = {
  PENDING:   "var(--warm-mute)",
  CONFIRMED: "var(--text)",
  COMPLETED: "var(--warm-mute)",
  CANCELLED: "var(--warm-mute)",
  NO_SHOW:   "var(--warm-mute)",
};

// ── COMPONENT ─────────────────────────────────────────────────

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [tenant,   setTenant]   = useState<TenantData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [used,     setUsed]     = useState(0);
  const [quota,    setQuota]    = useState(20);
  const [plan,     setPlan]     = useState("FREE");

  useEffect(() => {
    const user = getUser();
    if (!user?.tenantId) { setLoading(false); return; }

    const QUOTAS: Record<string, number> = { FREE: 20, PRO: 500, PREMIUM: Infinity };
    const headers = authHeaders();

    Promise.all([
      fetch(`/api/tenants/${user.tenantId}`,              { headers }).then(r => r.json()),
      fetch(`/api/bookings?tenantId=${user.tenantId}&pageSize=20`, { headers }).then(r => r.json()),
      fetch(`/api/services?tenantId=${user.tenantId}`,    { headers }).then(r => r.json()),
    ])
      .then(([tenantData, bookingsData, servicesData]) => {
        if (tenantData.data) {
          setTenant(tenantData.data);
          setPlan(tenantData.data.plan ?? "FREE");
          setQuota(QUOTAS[tenantData.data.plan] ?? 20);
          setUsed(tenantData.data.bookingsUsedMonth ?? 0);
        }
        if (bookingsData.data?.bookings) setBookings(bookingsData.data.bookings);
        if (servicesData.data?.services) setServices(servicesData.data.services);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── DERIVED METRICS ────────────────────────────────────────
  const now             = new Date();
  const todayBookings   = bookings.filter(b =>
    b.slot?.startsAt && new Date(b.slot.startsAt).toDateString() === now.toDateString()
  );
  const todayRevenue    = todayBookings.reduce((s, b) => s + (b.service?.priceCents ?? 0), 0);
  const remaining       = quota === Infinity ? Infinity : Math.max(0, quota - used);
  const quotaPct        = quota === Infinity ? 0 : Math.min(100, (used / quota) * 100);
  const hasSchedule     = Array.isArray(tenant?.horaires) && tenant!.horaires!.some(h => h.open);
  const needsOnboarding = !loading && (services.length === 0 || !tenant?.phone);

  const checkItems = [
    { label: "Compléter votre profil salon",     href: "/dashboard/profil",   done: !!tenant?.phone },
    { label: "Ajouter votre premier soin",       href: "/dashboard/services", done: services.length > 0 },
    { label: "Définir vos horaires d'ouverture", href: "/dashboard/horaires", done: hasSchedule },
  ];

  // ── RENDER — editorial composition ─────────────────────────
  return (
    <div style={{ padding: "44px 28px 64px", maxWidth: 760, margin: "0 auto" }}>

      {/* ── Eyebrow — soft uppercase credit ────────────────── */}
      <p
        style={{
          fontSize:       10,
          letterSpacing:  "0.28em",
          textTransform:  "uppercase",
          color:          "var(--warm-mute)",
          marginBottom:   12,
        }}
      >
        {formatTodayLong(now)}
      </p>

      {/* ── Greeting — Fraunces editorial ──────────────────── */}
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
        {greetingFor(now)}
        {tenant?.name ? `, ${tenant.name.split(" ")[0]}` : ""}.
      </h1>

      {/* ── Sub-greeting — quiet status sentence ──────────── */}
      <p
        style={{
          fontSize:    15,
          color:       "var(--text2)",
          lineHeight:  1.7,
          maxWidth:    520,
          marginBottom: 56,
        }}
      >
        {loading
          ? "Bienvenue dans votre atelier."
          : todayBookings.length === 0
            ? "Aucune réservation pour aujourd'hui. Profitez du calme."
            : todayBookings.length === 1
              ? "Une cliente est attendue aujourd'hui."
              : `${todayBookings.length} clientes sont attendues aujourd'hui.`}
      </p>

      {/* ── Onboarding — éditorial, sans card ─────────────── */}
      {needsOnboarding && (
        <section style={{ marginBottom: 56 }}>
          <h2
            style={{
              fontFamily:    "var(--font-fraunces, var(--serif))",
              fontSize:      14,
              fontWeight:    600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color:         "var(--warm-mute)",
              marginBottom:  20,
            }}
          >
            Préparer votre salon
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {checkItems.map((item, i) => (
              <Link
                key={item.label}
                href={item.href}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            16,
                  padding:        "16px 0",
                  textDecoration: "none",
                  borderTop:      i === 0 ? "1px solid var(--border)" : "none",
                  borderBottom:   "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    width:           20,
                    height:          20,
                    borderRadius:    99,
                    border:          item.done
                                       ? "none"
                                       : "1px solid var(--border2)",
                    background:      item.done ? "var(--text)" : "transparent",
                    color:           "var(--cream)",
                    display:         "flex",
                    alignItems:      "center",
                    justifyContent:  "center",
                    flexShrink:      0,
                  }}
                >
                  {item.done && <CheckMark />}
                </div>
                <span
                  style={{
                    flex:           1,
                    fontFamily:     "var(--font-fraunces, var(--serif))",
                    fontWeight:     500,
                    fontSize:       16,
                    color:          item.done ? "var(--warm-mute)" : "var(--text)",
                    textDecoration: item.done ? "line-through" : "none",
                  }}
                >
                  {item.label}
                </span>
                {!item.done && (
                  <span style={{ color: "var(--warm-mute)" }}>
                    <ArrowRight />
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Today's metrics — bare typography ──────────────── */}
      <section
        style={{
          display:              "grid",
          gridTemplateColumns:  "1fr 1fr",
          gap:                  "32px 48px",
          marginBottom:         56,
        }}
      >
        <div>
          <p style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--warm-mute)", marginBottom: 10 }}>
            Clientes
          </p>
          <p
            style={{
              fontFamily:    "var(--font-fraunces, var(--serif))",
              fontSize:      "clamp(2.25rem, 5vw, 3rem)",
              fontWeight:    600,
              color:         "var(--text)",
              letterSpacing: "-0.02em",
              lineHeight:    1,
            }}
          >
            {loading ? "—" : todayBookings.length}
          </p>
          <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 6 }}>
            attendues aujourd'hui
          </p>
        </div>

        <div>
          <p style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--warm-mute)", marginBottom: 10 }}>
            Recettes
          </p>
          <p
            style={{
              fontFamily:    "var(--font-fraunces, var(--serif))",
              fontSize:      "clamp(2.25rem, 5vw, 3rem)",
              fontWeight:    600,
              color:         "var(--text)",
              letterSpacing: "-0.02em",
              lineHeight:    1,
            }}
          >
            {loading
              ? "—"
              : todayRevenue > 0
                ? `${(todayRevenue / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}`
                : "—"}
            {todayRevenue > 0 && (
              <span style={{ fontSize: "0.45em", fontWeight: 500, color: "var(--warm-mute)", marginLeft: 6 }}>
                k FCFA
              </span>
            )}
          </p>
          <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 6 }}>
            estimées
          </p>
        </div>
      </section>

      {/* ── Quota — quiet line, never an alert ─────────────── */}
      {quota !== Infinity && (
        <section style={{ marginBottom: 56 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <p style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--warm-mute)" }}>
              Ce mois
            </p>
            <p style={{ fontSize: 12, color: "var(--text2)" }}>
              {used} sur {quota}
            </p>
          </div>
          {/* Hairline progress — almost invisible until full */}
          <div
            style={{
              height:       3,
              borderRadius: 99,
              background:   "var(--border)",
              overflow:     "hidden",
            }}
          >
            <div
              style={{
                height:     "100%",
                width:      `${quotaPct}%`,
                background: "var(--text)",
                opacity:    0.5,
                transition: "width 800ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>
          {plan === "FREE" && remaining < 5 && (
            <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 12 }}>
              Bientôt complet ce mois.{" "}
              <Link
                href="/plans"
                style={{ color: "var(--text)", textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                Découvrir le plan Pro
              </Link>
              .
            </p>
          )}
        </section>
      )}

      {/* ── Bookings — calm hairline list ──────────────────── */}
      <section style={{ marginBottom: 56 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
          <h2
            style={{
              fontFamily:    "var(--font-fraunces, var(--serif))",
              fontSize:      14,
              fontWeight:    600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color:         "var(--warm-mute)",
            }}
          >
            Réservations
          </h2>
          <Link
            href="/dashboard/bookings"
            style={{
              fontSize:       12,
              color:          "var(--text2)",
              textDecoration: "none",
              opacity:        0.85,
            }}
          >
            Tout voir
          </Link>
        </div>

        {loading && (
          <p style={{ fontSize: 13, color: "var(--warm-mute)", padding: "20px 0" }}>
            Chargement…
          </p>
        )}

        {!loading && bookings.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text2)", padding: "20px 0", lineHeight: 1.7 }}>
            Aucune réservation pour l'instant. Vos prochaines clientes apparaîtront ici, dès que vos horaires et soins seront ajoutés.
          </p>
        )}

        {!loading && bookings.length > 0 && (
          <div>
            {bookings.slice(0, 6).map((b, i) => (
              <Link
                key={b.id}
                href={`/dashboard/bookings#${b.id}`}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            16,
                  padding:        "18px 0",
                  textDecoration: "none",
                  borderTop:      i === 0 ? "1px solid var(--border)" : "none",
                  borderBottom:   "1px solid var(--border)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontFamily:    "var(--font-fraunces, var(--serif))",
                      fontWeight:    500,
                      fontSize:      16,
                      color:         "var(--text)",
                      letterSpacing: "-0.005em",
                      marginBottom:  3,
                    }}
                  >
                    {b.service?.name ?? "Réservation"}
                  </p>
                  {b.slot?.startsAt && (
                    <p style={{ fontSize: 12, color: "var(--warm-mute)" }}>
                      {new Date(b.slot.startsAt).toLocaleDateString("fr-FR", {
                        weekday: "short",
                        day:     "numeric",
                        month:   "short",
                        hour:    "2-digit",
                        minute:  "2-digit",
                      })}
                    </p>
                  )}
                </div>

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

                <p
                  style={{
                    fontSize:      10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color:         STATUS_TONE[b.status] ?? "var(--warm-mute)",
                    minWidth:      78,
                    textAlign:     "right",
                  }}
                >
                  {STATUS_LABEL[b.status] ?? b.status}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Pro upgrade — soft inline, never a CTA banner ──── */}
      {plan === "FREE" && !loading && (
        <section style={{ paddingTop: 40, borderTop: "1px solid var(--border)" }}>
          <p
            style={{
              fontFamily:    "var(--font-fraunces, var(--serif))",
              fontWeight:    500,
              fontSize:      16,
              color:         "var(--text)",
              letterSpacing: "-0.005em",
              marginBottom:  6,
            }}
          >
            Prête à accueillir plus de clientes ?
          </p>
          <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, marginBottom: 16 }}>
            Le plan Pro débloque jusqu'à 500 réservations par mois, des notifications WhatsApp automatiques et la possibilité de demander un acompte.
          </p>
          <Link
            href="/plans"
            style={{
              fontSize:       13,
              color:          "var(--text)",
              textDecoration: "underline",
              textUnderlineOffset: 4,
              fontWeight:     500,
            }}
          >
            Découvrir le plan Pro
          </Link>
        </section>
      )}
    </div>
  );
}
