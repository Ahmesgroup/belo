// ============================================================
// app/[lang]/page.tsx — Server-rendered localised landing page
//
// Static text (hero, how-it-works, CTA) is resolved server-side
// via getTranslations(lang) — zero client JS needed for that content,
// optimal for Core Web Vitals and SEO crawlers.
//
// Dynamic parts (featured salons fetched from API) are still server-
// rendered via Next.js fetch cache and hydrated on the client.
// ============================================================

import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, isValidLang, SEO_META, type SupportedLang } from "@/lib/i18n-server";
import { PublicNav } from "@/components/ui/Nav";

type Tenant = {
  id: string; name: string; slug: string;
  city: string | null; plan: string; coverUrl?: string | null;
  _count: { bookings: number };
};

type Props = { params: Promise<{ lang: string }> };

// ── Per-page metadata override (the layout already sets base metadata) ────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l   = isValidLang(lang) ? lang : "fr";
  const meta = SEO_META[l as SupportedLang];
  return {
    title:       meta.title,
    description: meta.description,
  };
}

// ── Featured salons — server-side fetch with 2-minute cache ──────────────────

async function getFeaturedSalons(): Promise<{ tenants: Tenant[]; total: number }> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res  = await fetch(`${base}/api/tenants?pageSize=4`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return { tenants: [], total: 0 };
    const d = await res.json();
    return {
      tenants: d.data?.tenants   ?? [],
      total:   d.data?.pagination?.total ?? 0,
    };
  } catch {
    return { tenants: [], total: 0 };
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function LandingPage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();

  const t                     = getTranslations(lang);
  const { tenants, total }    = await getFeaturedSalons();
  const base                  = process.env.NEXT_PUBLIC_APP_URL ?? "https://belo-khaki.vercel.app";

  const planBadge = (p: string) =>
    p === "PREMIUM" ? { bg: "rgba(144,96,232,.12)", color: "var(--purple)", text: "★ Premium" } :
    p === "PRO"     ? { bg: "rgba(245,166,35,.12)",  color: "var(--amber)",  text: "⚡ PRO"     } :
                      { bg: "rgba(34,211,138,.12)",   color: "var(--g2)",    text: "● Actif"   };

  return (
    <>
      <PublicNav />
      <main style={{ paddingTop: 56 }}>

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <section style={{ padding: "80px 5vw 60px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "15%", left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse at center,rgba(34,211,138,.07) 0%,transparent 70%)", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1, maxWidth: 720, width: "100%" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(34,211,138,.08)", border: "1px solid rgba(34,211,138,.18)", color: "var(--g2)", fontSize: 11, fontWeight: 600, padding: "5px 14px", borderRadius: 99, marginBottom: 24, letterSpacing: ".06em" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--g2)", animation: "pulse 2s infinite" }} />
              ✦ {lang === "fr" ? "Disponible à Dakar, Thiès, Saint-Louis" : "Available in Dakar, Thiès, Saint-Louis"}
            </div>

            <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(36px,5.5vw,68px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.03em", marginBottom: 20 }}>
              {t("hero_title")}<br />
              <span style={{ color: "var(--g2)", fontStyle: "italic" }}>{t("hero_title2")}</span><br />
              <span style={{ color: "var(--text2)" }}>{t("hero_sub")}</span>
            </h1>

            <p style={{ fontSize: 16, color: "var(--text2)", lineHeight: 1.7, maxWidth: 520, margin: "0 auto 32px" }}>
              {t("hero_desc")}
            </p>

            {/* Search box — client-side interaction handled by the Nav */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
              <Link href={`/${lang}/salons`} style={{ padding: "13px 28px", borderRadius: 12, background: "var(--g)", color: "#fff", fontFamily: "var(--serif)", fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
                {t("cta_find")}
              </Link>
              <Link href={`/${lang}/salons`} style={{ padding: "13px 24px", borderRadius: 12, background: "rgba(255,255,255,.06)", color: "var(--text)", border: "1px solid var(--border2)", fontSize: 14, textDecoration: "none" }}>
                {t("cta_salons")}
              </Link>
            </div>

            {/* Live stats */}
            <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", maxWidth: 600, width: "100%", margin: "0 auto" }}>
              {[
                [total > 0 ? `${Math.round(total * 50)}+` : "250+", lang === "fr" ? "Réservations" : "Bookings"],
                [total > 0 ? `${total}+` : "5+",                    lang === "fr" ? "Salons partenaires" : "Partner salons"],
                ["4.8★",                                              lang === "fr" ? "Note moyenne" : "Avg. rating"],
                ["Wave ✓",                                            "+ Orange Money"],
              ].map(([n, l], idx) => (
                <div key={idx} style={{ flex: 1, minWidth: 120, padding: "16px 18px", textAlign: "center", borderRight: idx < 3 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 700, color: "var(--g2)", lineHeight: 1, marginBottom: 3 }}>{n}</div>
                  <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".05em" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURED SALONS ──────────────────────────────────────── */}
        <section style={{ padding: "48px 5vw", maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 700 }}>{t("featured_salons")}</h2>
            <Link href={`/${lang}/salons`} style={{ padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600, border: "1px solid var(--border2)", color: "var(--text2)", textDecoration: "none" }}>{t("see_all")}</Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
            {tenants.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                    <div style={{ height: 140, background: "rgba(255,255,255,.05)" }} />
                    <div style={{ padding: 14 }}>
                      <div style={{ height: 16, width: "60%", background: "rgba(255,255,255,.06)", borderRadius: 5, marginBottom: 10 }} />
                      <div style={{ height: 32, background: "rgba(255,255,255,.04)", borderRadius: 9 }} />
                    </div>
                  </div>
                ))
              : tenants.map(s => {
                  const b = planBadge(s.plan);
                  return (
                    <div key={s.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                      <div style={{ height: 140, background: "linear-gradient(135deg,#1a2a1a,#0d2d1a)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, overflow: "hidden" }}>
                        {s.coverUrl
                          ? <img src={s.coverUrl} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                          : <span style={{ position: "relative", zIndex: 1 }}>💇‍♀️</span>
                        }
                        <div style={{ position: "absolute", top: 10, right: 10, background: b.bg, color: b.color, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, zIndex: 2 }}>{b.text}</div>
                      </div>
                      <div style={{ padding: 14 }}>
                        <div style={{ fontFamily: "var(--serif)", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{s.name}</div>
                        {s.city && <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10 }}>📍 {s.city}</div>}
                        <Link href={`/booking/${s.slug}`} style={{ display: "block", padding: 8, borderRadius: 9, background: "var(--g)", color: "#fff", fontSize: 12, fontWeight: 600, textAlign: "center", textDecoration: "none" }}>
                          {t("salon_book")}
                        </Link>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
        <section id="how" style={{ padding: "60px 5vw", background: "rgba(11,15,22,.4)", borderTop: "1px solid var(--border)" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(24px,4vw,40px)", fontWeight: 800, marginBottom: 12 }}>{t("how_title")}</h2>
            <p style={{ color: "var(--text2)", fontSize: 15, marginBottom: 40 }}>{t("how_sub")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 20 }}>
              {([
                ["🔍", t("step1_title"), t("step1_desc"), t("step1_time")],
                ["🕐", t("step2_title"), t("step2_desc"), t("step2_time")],
                ["💳", t("step3_title"), t("step3_desc"), t("step3_time")],
                ["✅", t("step4_title"), t("step4_desc"), t("step4_time")],
              ] as [string, string, string, string][]).map(([icon, title, desc, time]) => (
                <div key={title} style={{ textAlign: "center", padding: "0 16px" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--card)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 16px" }}>{icon}</div>
                  <div style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5, marginBottom: 10 }}>{desc}</div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--g2)", background: "rgba(34,211,138,.08)", border: "1px solid rgba(34,211,138,.15)", padding: "3px 10px", borderRadius: 99 }}>{time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <section style={{ padding: "60px 5vw", textAlign: "center" }}>
          <div style={{ maxWidth: 600, margin: "0 auto", background: "var(--card)", border: "1px solid var(--border2)", borderRadius: 24, padding: "48px 32px" }}>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(24px,4vw,40px)", fontWeight: 800, marginBottom: 12 }}>
              {lang === "fr" ? "Votre prochain rendez-vous vous attend" : "Your next appointment is waiting"}
            </h2>
            <p style={{ color: "var(--text2)", marginBottom: 28 }}>
              {total > 0 ? total : "…"} {lang === "fr" ? "salons disponibles" : "salons available"}. {lang === "fr" ? "Réservation en 45 secondes." : "Book in 45 seconds."}</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href={`/${lang}/salons`} style={{ padding: "13px 26px", borderRadius: 12, background: "var(--g)", color: "#fff", fontFamily: "var(--serif)", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>{t("cta_find")}</Link>
              <Link href="/plans" style={{ padding: "13px 26px", borderRadius: 12, background: "rgba(255,255,255,.06)", color: "var(--text)", border: "1px solid var(--border2)", fontSize: 14, textDecoration: "none" }}>{t("cta_salons")}</Link>
            </div>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────────── */}
        <footer style={{ padding: "32px 5vw", borderTop: "1px solid var(--border)", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            belo<span style={{ color: "var(--g2)" }}>.</span>
          </div>
          <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
            {[
              [t("about"),   "/"],
              [lang === "fr" ? "Salons" : "Salons",         `/${lang}/salons`],
              [lang === "fr" ? "Pour les gérants" : "For salon owners", "/pour-les-salons"],
              ["Plans",       "/plans"],
              [t("privacy"),  "/confidentialite"],
              [t("contact"),  "mailto:contact@belo.sn"],
            ].map(([label, href]) => (
              <Link key={label} href={href} style={{ fontSize: 12, color: "var(--text3)", textDecoration: "none" }}>{label}</Link>
            ))}
          </div>

          {/* hreflang alternate links for accessibility */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 12 }}>
            <Link href="/fr" hrefLang="fr" style={{ fontSize: 11, color: lang === "fr" ? "var(--g2)" : "var(--text3)", textDecoration: "none" }}>🇫🇷 Français</Link>
            <Link href="/en" hrefLang="en" style={{ fontSize: 11, color: lang === "en" ? "var(--g2)" : "var(--text3)", textDecoration: "none" }}>🇬🇧 English</Link>
          </div>

          <p style={{ fontSize: 11, color: "var(--text3)" }}>
            © 2026 Belo · Dakar, Sénégal — {t("footer_tagline")}
          </p>
        </footer>
      </main>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
      `}</style>
    </>
  );
}
