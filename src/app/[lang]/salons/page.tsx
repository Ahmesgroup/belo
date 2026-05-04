// ============================================================
// app/[lang]/salons/page.tsx — Server-rendered localised salons listing
// ============================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, isValidLang, type SupportedLang } from "@/lib/i18n-server";
import { PublicNav } from "@/components/ui/Nav";

type Props = {
  params:      Promise<{ lang: string }>;
  searchParams:Promise<{ search?: string; city?: string; cat?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l = isValidLang(lang) ? lang : "fr";
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://belo-khaki.vercel.app";
  const isFr = l === "fr";

  return {
    title:       isFr ? "Salons — Beauté & Bien-être" : "Salons — Beauty & Wellness",
    description: isFr
      ? "Découvrez tous les salons de beauté disponibles sur Belo. Coiffure, manucure, massage, spa."
      : "Discover all beauty salons available on Belo. Hair, nails, massage, spa.",
    alternates: {
      canonical: `${base}/${l}/salons`,
      languages: {
        fr: `${base}/fr/salons`,
        en: `${base}/en/salons`,
        "x-default": `${base}/fr/salons`,
      },
    },
  };
}

type Tenant = {
  id: string; name: string; slug: string;
  city: string | null; plan: string; coverUrl?: string | null;
  _count: { bookings: number };
};

async function getSalons(search?: string, city?: string): Promise<{ tenants: Tenant[]; total: number }> {
  try {
    const base   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const params = new URLSearchParams({ pageSize: "20" });
    if (search) params.set("search", search);
    if (city)   params.set("city",   city);

    const res = await fetch(`${base}/api/tenants?${params}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { tenants: [], total: 0 };
    const d = await res.json();
    return {
      tenants: d.data?.tenants  ?? [],
      total:   d.data?.pagination?.total ?? 0,
    };
  } catch {
    return { tenants: [], total: 0 };
  }
}

const planBadge = (p: string) =>
  p === "PREMIUM" ? { bg: "rgba(144,96,232,.12)", color: "var(--purple)", text: "★ Premium" } :
  p === "PRO"     ? { bg: "rgba(245,166,35,.12)",  color: "var(--amber)",  text: "⚡ PRO"     } :
                    { bg: "rgba(34,211,138,.12)",   color: "var(--g2)",    text: "● Actif"   };

export default async function SalonsPage({ params, searchParams }: Props) {
  const { lang }                     = await params;
  const { search, city, cat }        = await searchParams;
  if (!isValidLang(lang)) notFound();

  const t                            = getTranslations(lang);
  const { tenants, total }           = await getSalons(search, city);

  const CATEGORIES = [
    [t("cat_all"),     ""],
    [t("cat_hair"),    "hair"],
    [t("cat_nails"),   "nails"],
    [t("cat_massage"), "massage"],
    [t("cat_care"),    "spa"],
    [t("cat_makeup"),  "makeup"],
  ] as [string, string][];

  return (
    <>
      <PublicNav />
      <main style={{ paddingTop: 56 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 5vw 60px" }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
              {t("all_salons")}
            </h1>
            <p style={{ color: "var(--text3)", fontSize: 13 }}>
              {total} {total !== 1 ? t("salons_count_pl") : t("salons_count")}
            </p>
          </div>

          {/* Search form — POST to same URL so it stays server-rendered */}
          <form method="GET" action={`/${lang}/salons`} style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            <input name="search" defaultValue={search ?? ""} placeholder={t("search_salon")}
              style={{ flex: 2, minWidth: 200, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border2)", background: "var(--card)", color: "var(--text)", fontSize: 13 }} />
            <input name="city" defaultValue={city ?? ""} placeholder={lang === "fr" ? "Ville…" : "City…"}
              style={{ flex: 1, minWidth: 140, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border2)", background: "var(--card)", color: "var(--text)", fontSize: 13 }} />
            <button type="submit" style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--g)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {t("search_btn")}
            </button>
          </form>

          {/* Category pills */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            {CATEGORIES.map(([label, value]) => (
              <Link key={value} href={value ? `/${lang}/salons?cat=${encodeURIComponent(value)}` : `/${lang}/salons`}
                style={{ padding: "5px 14px", borderRadius: 99, border: `1px solid ${cat === value ? "rgba(34,211,138,.4)" : "var(--border2)"}`, background: cat === value ? "rgba(34,211,138,.08)" : "transparent", color: cat === value ? "var(--g2)" : "var(--text3)", fontSize: 11, textDecoration: "none", whiteSpace: "nowrap" }}>
                {label}
              </Link>
            ))}
          </div>

          {/* Salon grid */}
          {tenants.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text3)" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <p style={{ fontSize: 14 }}>{lang === "fr" ? "Aucun salon trouvé." : "No salons found."}</p>
              <Link href={`/${lang}/salons`} style={{ color: "var(--g2)", fontSize: 12, marginTop: 8, display: "inline-block" }}>{t("back")}</Link>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
              {tenants.map(s => {
                const b = planBadge(s.plan);
                return (
                  <div key={s.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                    <div style={{ height: 140, background: "linear-gradient(135deg,#1a2a1a,#0d2d1a)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>
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
              })}
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <Link href={`/${lang}`} style={{ fontSize: 12, color: "var(--text3)", textDecoration: "none" }}>← {lang === "fr" ? "Accueil" : "Home"}</Link>
          </div>
        </div>
      </main>
    </>
  );
}
