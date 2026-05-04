// app/[lang]/salons/[city]/page.tsx
// SEO-optimised city-specific salon listing.
// Pre-built at deploy time for all known city slugs via generateStaticParams.
// URL: /fr/salons/dakar  /en/salons/paris  /fr/salons/bruxelles

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations, isValidLang, type SupportedLang } from "@/lib/i18n-server";
import { getLocalized } from "@/lib/i18n-localize";
import { PublicNav } from "@/components/ui/Nav";
import { prisma } from "@/infrastructure/db/prisma";

export const revalidate = 300; // 5 minutes

type Props = {
  params:      Promise<{ lang: string; city: string }>;
  searchParams:Promise<{ cat?: string }>;
};

// Pre-render the most important city pages at build time
export async function generateStaticParams() {
  const langs  = ["fr", "en"];
  const cities = await prisma.city.findMany({ where: { isActive: true }, select: { slug: true } }).catch(() => []);
  return langs.flatMap(lang => cities.map(c => ({ lang, city: c.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, city } = await params;
  const l    = isValidLang(lang) ? lang : "fr";
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://belo-khaki.vercel.app";
  const isFr = l === "fr";

  const cityRecord = await prisma.city.findUnique({
    where:   { slug: city },
    include: { country: true },
  }).catch(() => null);

  const cityName = cityRecord ? getLocalized(cityRecord.name as any, l, city) : city;
  const countryName = cityRecord ? getLocalized(cityRecord.country.name as any, l, "") : "";

  return {
    title:       isFr ? `Salons de beauté à ${cityName}` : `Beauty salons in ${cityName}`,
    description: isFr
      ? `Réservez les meilleurs salons de coiffure et de beauté à ${cityName}${countryName ? `, ${countryName}` : ""}. Confirmation WhatsApp instantanée.`
      : `Book the best hair and beauty salons in ${cityName}${countryName ? `, ${countryName}` : ""}. Instant WhatsApp confirmation.`,
    alternates: {
      canonical: `${base}/${l}/salons/${city}`,
      languages: {
        fr: `${base}/fr/salons/${city}`,
        en: `${base}/en/salons/${city}`,
        "x-default": `${base}/fr/salons/${city}`,
      },
    },
    openGraph: {
      type:  "website",
      url:   `${base}/${l}/salons/${city}`,
      title: isFr ? `Salons de beauté à ${cityName}` : `Beauty salons in ${cityName}`,
    },
  };
}

const planBadge = (p: string) =>
  p === "PREMIUM" ? { bg: "rgba(144,96,232,.12)", color: "var(--purple)", text: "★ Premium" } :
  p === "PRO"     ? { bg: "rgba(245,166,35,.12)",  color: "var(--amber)",  text: "⚡ PRO"     } :
                    { bg: "rgba(34,211,138,.12)",   color: "var(--g2)",    text: "● Actif"    };

export default async function CitySalonsPage({ params, searchParams }: Props) {
  const { lang, city } = await params;
  const { cat }        = await searchParams;
  if (!isValidLang(lang)) notFound();

  const t = getTranslations(lang);

  // Resolve city record
  const cityRecord = await prisma.city.findUnique({
    where:   { slug: city },
    include: { country: true },
  }).catch(() => null);

  if (!cityRecord) notFound();

  const cityName    = getLocalized(cityRecord.name    as any, lang, city);
  const countryName = getLocalized(cityRecord.country.name as any, lang, "");

  // Fetch salons in this city
  const cityVariants = [
    cityName,
    city,
    city.replace(/-/g, " "),
  ];

  const where: any = {
    status:    "ACTIVE",
    deletedAt: null,
    OR: cityVariants.map(v => ({ city: { contains: v, mode: "insensitive" } })),
  };
  if (cat) where.services = { some: { category: cat, isActive: true } };

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      select: { id: true, name: true, slug: true, city: true, plan: true, coverUrl: true, _count: { select: { bookings: true } } },
      orderBy: [{ plan: "desc" }, { createdAt: "desc" }],
      take: 24,
    }),
    prisma.tenant.count({ where }),
  ]);

  const CATEGORIES: [string, string][] = [
    [t("cat_all"), ""], [t("cat_hair"), "hair"], [t("cat_nails"), "nails"],
    [t("cat_massage"), "massage"], [t("cat_care"), "spa"], [t("cat_makeup"), "makeup"],
  ];

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://belo-khaki.vercel.app";

  return (
    <>
      <PublicNav />
      <main style={{ paddingTop: 56 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 5vw 60px" }}>

          {/* Breadcrumb */}
          <nav aria-label="breadcrumb" style={{ fontSize: 12, color: "var(--text3)", marginBottom: 20 }}>
            <Link href={`/${lang}`} style={{ color: "var(--text3)", textDecoration: "none" }}>{lang === "fr" ? "Accueil" : "Home"}</Link>
            {" / "}
            <Link href={`/${lang}/salons`} style={{ color: "var(--text3)", textDecoration: "none" }}>{t("all_salons")}</Link>
            {" / "}
            <span style={{ color: "var(--text)" }}>{cityName}</span>
          </nav>

          {/* Header */}
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
            {lang === "fr" ? `Salons de beauté à ${cityName}` : `Beauty salons in ${cityName}`}
          </h1>
          {countryName && (
            <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 8 }}>📍 {cityName}, {countryName}</p>
          )}
          <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 24 }}>
            {total} {total !== 1 ? t("salons_count_pl") : t("salons_count")}
          </p>

          {/* Structured data — LocalBusiness (SEO) */}
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type":    "ItemList",
            "name":     lang === "fr" ? `Salons de beauté à ${cityName}` : `Beauty salons in ${cityName}`,
            "url":      `${base}/${lang}/salons/${city}`,
            "numberOfItems": total,
          }) }} />

          {/* Category filter */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            {CATEGORIES.map(([label, value]) => (
              <Link key={value}
                href={value ? `/${lang}/salons/${city}?cat=${encodeURIComponent(value)}` : `/${lang}/salons/${city}`}
                style={{ padding: "5px 14px", borderRadius: 99, border: `1px solid ${cat === value ? "rgba(34,211,138,.4)" : "var(--border2)"}`, background: cat === value ? "rgba(34,211,138,.08)" : "transparent", color: cat === value ? "var(--g2)" : "var(--text3)", fontSize: 11, textDecoration: "none", whiteSpace: "nowrap" }}>
                {label}
              </Link>
            ))}
          </div>

          {/* Salon grid */}
          {tenants.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text3)" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <p>{lang === "fr" ? `Aucun salon disponible à ${cityName} pour l'instant.` : `No salons available in ${cityName} yet.`}</p>
              <Link href={`/${lang}/salons`} style={{ color: "var(--g2)", fontSize: 12, marginTop: 8, display: "inline-block" }}>
                {lang === "fr" ? "Voir tous les salons →" : "Browse all salons →"}
              </Link>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
              {tenants.map((s: any) => {
                const b = planBadge(s.plan);
                return (
                  <div key={s.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                    <div style={{ height: 140, background: "linear-gradient(135deg,#1a2a1a,#0d2d1a)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>
                      {s.coverUrl ? <img src={s.coverUrl} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} /> : <span style={{ position: "relative", zIndex: 1 }}>💇‍♀️</span>}
                      <div style={{ position: "absolute", top: 10, right: 10, background: b.bg, color: b.color, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, zIndex: 2 }}>{b.text}</div>
                    </div>
                    <div style={{ padding: 14 }}>
                      <div style={{ fontFamily: "var(--serif)", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{s.name}</div>
                      {s.city && <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10 }}>📍 {s.city}</div>}
                      <Link href={`/booking/${s.slug}`} style={{ display: "block", padding: 8, borderRadius: 9, background: "var(--g)", color: "#fff", fontSize: 12, fontWeight: 600, textAlign: "center", textDecoration: "none" }}>{t("salon_book")}</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Other cities */}
          <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid var(--border)" }}>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              {lang === "fr" ? "Autres villes" : "Other cities"}
            </h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["dakar", "paris", "bruxelles", "casablanca", "abidjan", "luxembourg"].filter(c => c !== city).map(slug => (
                <Link key={slug} href={`/${lang}/salons/${slug}`}
                  style={{ padding: "6px 14px", borderRadius: 99, border: "1px solid var(--border2)", color: "var(--text3)", fontSize: 12, textDecoration: "none", textTransform: "capitalize" }}>
                  {slug.replace(/-/g, " ")}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
