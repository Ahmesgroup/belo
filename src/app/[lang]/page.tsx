import { notFound }         from "next/navigation";
import Link                  from "next/link";
import type { Metadata }     from "next";
import { getTranslations, isValidLang, SEO_META, type SupportedLang } from "@/lib/i18n-server";
import { PublicNav }         from "@/components/ui/Nav";
import SearchBar             from "@/components/SearchBar";
import { prisma }            from "@/infrastructure/db/prisma";

export const revalidate = 120;

type Tenant = {
  id: string; name: string; slug: string;
  city: string | null; plan: string; coverUrl: string | null;
  _count: { bookings: number };
};

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l   = isValidLang(lang) ? lang : "fr";
  const m   = SEO_META[l as SupportedLang];
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://belo-khaki.vercel.app";
  return {
    title: m.title,
    description: m.description,
    keywords: [...m.keywords],
    alternates: {
      canonical: `${base}/${l}`,
      languages: { fr: `${base}/fr`, en: `${base}/en`, "x-default": `${base}/fr` },
    },
    openGraph: { title: m.title, description: m.description, locale: m.locale, type: "website" },
    twitter:   { card: "summary_large_image", title: m.title, description: m.description },
  };
}

async function getHomeData(): Promise<{ tenants: Tenant[]; total: number }> {
  try {
    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where:   { status: "ACTIVE", deletedAt: null },
        select:  { id: true, name: true, slug: true, city: true, plan: true, coverUrl: true, _count: { select: { bookings: true } } },
        orderBy: [{ plan: "desc" }, { createdAt: "desc" }],
        take:    4,
      }),
      prisma.tenant.count({ where: { status: "ACTIVE", deletedAt: null } }),
    ]);
    return { tenants, total };
  } catch { return { tenants: [], total: 0 }; }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  if (plan === "PREMIUM") return <span className="absolute top-3 right-3 bg-purple/20 text-purple text-[10px] font-bold px-2.5 py-0.5 rounded-full z-10">★ Premium</span>;
  if (plan === "PRO")     return <span className="absolute top-3 right-3 bg-amber/20  text-amber  text-[10px] font-bold px-2.5 py-0.5 rounded-full z-10">⚡ PRO</span>;
  return null;
}

const CATEGORIES = [
  { slug: "hair",    emoji: "💇‍♀️", labelFr: "Coiffure",  labelEn: "Haircut"   },
  { slug: "nails",   emoji: "💅",    labelFr: "Manucure",  labelEn: "Nails"     },
  { slug: "massage", emoji: "💆‍♀️", labelFr: "Massage",   labelEn: "Massage"   },
  { slug: "beauty",  emoji: "🧖‍♀️", labelFr: "Soins",     labelEn: "Beauty"    },
  { slug: "makeup",  emoji: "💄",    labelFr: "Maquillage",labelEn: "Makeup"    },
  { slug: "barber",  emoji: "✂️",    labelFr: "Barbershop",labelEn: "Barbershop"},
];

const TOP_CITIES = [
  { slug: "dakar",      name: "Dakar",      country: "🇸🇳", desc: "Sénégal" },
  { slug: "abidjan",    name: "Abidjan",    country: "🇨🇮", desc: "Côte d'Ivoire" },
  { slug: "casablanca", name: "Casablanca", country: "🇲🇦", desc: "Maroc" },
  { slug: "paris",      name: "Paris",      country: "🇫🇷", desc: "France" },
  { slug: "bruxelles",  name: "Bruxelles",  country: "🇧🇪", desc: "Belgique" },
  { slug: "luxembourg", name: "Luxembourg", country: "🇱🇺", desc: "Luxembourg" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function LandingPage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();

  const t                  = getTranslations(lang);
  const { tenants, total } = await getHomeData();
  const isFr               = lang === "fr";

  return (
    <>
      <PublicNav />

      <main className="bg-bg text-text min-h-screen">

        {/* ── HERO ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-32 pb-24 px-5">
          {/* Glow blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-g2/[0.06] blur-3xl" />
            <div className="absolute top-40 -left-20 w-72 h-72 rounded-full bg-blue/[0.04] blur-3xl" />
            <div className="absolute top-20 -right-20 w-72 h-72 rounded-full bg-purple/[0.04] blur-3xl" />
          </div>

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            {/* Availability pill */}
            <div className="inline-flex items-center gap-2 bg-g2/10 border border-g2/20 text-g2 text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-g2 animate-pulse" />
              ✦ {isFr ? "Disponible à Dakar, Paris, Bruxelles" : "Available in Dakar, Paris, Brussels"}
            </div>

            {/* Headline */}
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight mb-6">
              {t("hero_title")}<br />
              <span className="text-g2 italic">{t("hero_title2")}</span>
            </h1>

            <p className="text-text2 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              {t("hero_desc")}
            </p>

            {/* SearchBar */}
            <SearchBar
              lang={lang as SupportedLang}
              placeholder={t("search_service")}
              cityPlaceholder={isFr ? "Ville" : "City"}
              buttonLabel={t("search_btn")}
            />

            {/* Live stats */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-text3">
              <span className="flex items-center gap-1.5">
                <span className="text-g2 font-bold">{total > 0 ? `${total}+` : "20+"}</span>
                {isFr ? "salons partenaires" : "partner salons"}
              </span>
              <span className="w-px h-4 bg-border2" />
              <span className="flex items-center gap-1.5">
                <span className="text-g2 font-bold">4.8★</span>
                {isFr ? "note moyenne" : "avg. rating"}
              </span>
              <span className="w-px h-4 bg-border2" />
              <span className="flex items-center gap-1.5">
                <span className="text-g2 font-bold">Wave ✓</span>
                Orange Money
              </span>
            </div>
          </div>
        </section>

        {/* ── CATEGORIES ────────────────────────────────────────── */}
        <section className="px-5 py-16 max-w-6xl mx-auto">
          <h2 className="font-serif text-2xl font-bold mb-8 text-center">
            {isFr ? "Explorez par catégorie" : "Browse by category"}
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {CATEGORIES.map(cat => (
              <Link
                key={cat.slug}
                href={`/${lang}/salons?cat=${cat.slug}`}
                className="
                  group flex flex-col items-center gap-2 p-4 rounded-2xl
                  bg-card border border-border
                  hover:border-g2/40 hover:bg-g2/5
                  transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft
                "
              >
                <span className="text-3xl">{cat.emoji}</span>
                <span className="text-xs font-semibold text-text2 group-hover:text-g2 transition-colors text-center">
                  {isFr ? cat.labelFr : cat.labelEn}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FEATURED SALONS ───────────────────────────────────── */}
        <section className="px-5 py-16 bg-card2/40">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-serif text-2xl font-bold">{t("featured_salons")}</h2>
              <Link
                href={`/${lang}/salons`}
                className="text-sm font-semibold text-g2 hover:text-g3 transition-colors"
              >
                {t("see_all")} →
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {tenants.length === 0
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-card border border-border overflow-hidden animate-pulse">
                      <div className="h-44 bg-card2" />
                      <div className="p-4 space-y-2">
                        <div className="h-4 bg-card2 rounded w-3/4" />
                        <div className="h-3 bg-card2 rounded w-1/2" />
                        <div className="h-9 bg-card2 rounded-xl mt-3" />
                      </div>
                    </div>
                  ))
                : tenants.map(s => (
                    <div
                      key={s.id}
                      className="group rounded-2xl bg-card border border-border overflow-hidden hover:border-g2/30 hover:shadow-card transition-all duration-200 hover:-translate-y-0.5"
                    >
                      <div className="relative h-44 bg-gradient-to-br from-[#1a2a1a] to-[#0d2d1a] overflow-hidden">
                        {s.coverUrl
                          ? <img src={s.coverUrl} alt={s.name} className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" />
                          : <div className="absolute inset-0 flex items-center justify-center text-5xl">💇‍♀️</div>
                        }
                        <PlanBadge plan={s.plan} />
                        {s._count.bookings > 0 && (
                          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            ★ 4.8 · {s._count.bookings} {isFr ? "réservations" : "bookings"}
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-sm mb-1 truncate">{s.name}</h3>
                        {s.city && (
                          <p className="text-text3 text-xs mb-3">📍 {s.city}</p>
                        )}
                        <Link
                          href={`/booking/${s.slug}`}
                          className="
                            block w-full text-center py-2 rounded-xl text-sm font-semibold
                            bg-g1 text-white hover:bg-g3 transition-colors duration-200
                          "
                        >
                          {t("salon_book")}
                        </Link>
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        </section>

        {/* ── TOP CITIES ────────────────────────────────────────── */}
        <section className="px-5 py-16 max-w-6xl mx-auto">
          <h2 className="font-serif text-2xl font-bold mb-2 text-center">
            {isFr ? "Réservez dans votre ville" : "Book in your city"}
          </h2>
          <p className="text-text3 text-sm text-center mb-8">
            {isFr ? "Disponible en Afrique et en Europe" : "Available across Africa and Europe"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {TOP_CITIES.map(city => (
              <Link
                key={city.slug}
                href={`/${lang}/salons/${city.slug}`}
                className="
                  group flex flex-col items-center gap-2 p-4 rounded-2xl
                  bg-card border border-border text-center
                  hover:border-g2/40 hover:bg-g2/5
                  transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft
                "
              >
                <span className="text-3xl">{city.country}</span>
                <span className="text-sm font-semibold group-hover:text-g2 transition-colors">{city.name}</span>
                <span className="text-text3 text-[10px]">{city.desc}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────── */}
        <section className="px-5 py-20 bg-card2/40">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="font-serif text-3xl font-extrabold mb-4">{t("how_title")}</h2>
            <p className="text-text2 mb-14 max-w-lg mx-auto">{t("how_sub")}</p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {([
                ["🔍", t("step1_title"), t("step1_desc"), t("step1_time"), "from-g2/20 to-g1/10"],
                ["🕐", t("step2_title"), t("step2_desc"), t("step2_time"), "from-blue/20 to-blue/5"],
                ["💳", t("step3_title"), t("step3_desc"), t("step3_time"), "from-amber/20 to-amber/5"],
                ["✅", t("step4_title"), t("step4_desc"), t("step4_time"), "from-g2/20 to-g1/10"],
              ] as [string, string, string, string, string][]).map(([icon, title, desc, time, gradient], i) => (
                <div key={i} className="relative text-center p-6 rounded-2xl bg-card border border-border hover:border-g2/30 transition-all duration-200 hover:shadow-soft">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl mx-auto mb-4`}>
                    {icon}
                  </div>
                  <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-g1 text-white text-xs font-bold flex items-center justify-center shadow-green">
                    {i + 1}
                  </div>
                  <h3 className="font-serif font-semibold text-sm mb-2">{title}</h3>
                  <p className="text-text3 text-xs leading-relaxed mb-3">{desc}</p>
                  <span className="inline-block text-[10px] font-semibold text-g2 bg-g2/10 border border-g2/20 px-3 py-1 rounded-full">
                    {time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ─────────────────────────────────────────── */}
        <section className="px-5 py-20">
          <div className="max-w-2xl mx-auto bg-card border border-border rounded-3xl p-10 text-center shadow-card">
            <div className="inline-flex items-center gap-2 bg-g2/10 border border-g2/20 text-g2 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-g2 animate-pulse" />
              {total > 0 ? total : "…"} {isFr ? "salons disponibles" : "salons available"}
            </div>
            <h2 className="font-serif text-3xl font-extrabold mb-4 leading-tight">
              {isFr ? "Votre prochain rendez-vous\nvous attend" : "Your next appointment\nis waiting"}
            </h2>
            <p className="text-text2 text-sm mb-8">
              {isFr ? "Réservation en 45 secondes. Confirmation WhatsApp instantanée." : "Book in 45 seconds. Instant WhatsApp confirmation."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/${lang}/salons`}
                className="px-8 py-3 rounded-xl bg-g1 text-white font-semibold text-sm hover:bg-g3 transition-colors shadow-green"
              >
                {t("cta_find")}
              </Link>
              <Link
                href="/pour-les-salons"
                className="px-8 py-3 rounded-xl border border-border2 text-text2 font-semibold text-sm hover:bg-card2 transition-colors"
              >
                {t("cta_salons")}
              </Link>
            </div>
          </div>
        </section>

        {/* ── FOOTER ────────────────────────────────────────────── */}
        <footer className="px-5 py-10 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="font-serif text-xl font-extrabold">
                belo<span className="text-g2">.</span>
              </div>
              <nav className="flex flex-wrap gap-5 text-xs text-text3 justify-center">
                {[
                  [isFr ? "Accueil" : "Home", `/${lang}`],
                  [isFr ? "Salons" : "Salons", `/${lang}/salons`],
                  ["Plans", "/plans"],
                  [isFr ? "Pour les gérants" : "For salons", "/pour-les-salons"],
                  [isFr ? "Confidentialité" : "Privacy", "/confidentialite"],
                ].map(([label, href]) => (
                  <Link key={label} href={href} className="hover:text-g2 transition-colors">{label}</Link>
                ))}
              </nav>
              <div className="flex gap-3">
                <Link href="/fr" hrefLang="fr" className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${lang === "fr" ? "border-g2/40 text-g2 bg-g2/10" : "border-border2 text-text3 hover:text-text"}`}>🇫🇷 FR</Link>
                <Link href="/en" hrefLang="en" className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${lang === "en" ? "border-g2/40 text-g2 bg-g2/10" : "border-border2 text-text3 hover:text-text"}`}>🇬🇧 EN</Link>
              </div>
            </div>
            <p className="mt-6 text-center text-xs text-text3">
              © 2026 Belo · Dakar · Paris · Bruxelles — {t("footer_tagline")}
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
