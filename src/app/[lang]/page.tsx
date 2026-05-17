import { notFound }       from "next/navigation";
import { headers }        from "next/headers";
import Link               from "next/link";
import type { Metadata }  from "next";
import { getTranslations, isValidLang, SEO_META, type SupportedLang } from "@/lib/i18n-server";
import { PublicNav }      from "@/components/ui/Nav";
import { LangSwitcher }   from "@/components/ui/LangSwitcher";
import SearchBar          from "@/components/SearchBar";
import { SalonCard }      from "@/components/ui/SalonCard";
import { SalonCardSkeleton } from "@/components/ui/SalonCard";
import { prisma }         from "@/infrastructure/db/prisma";
import { detectMarket }   from "@/lib/market/detect";
import { buildEditorialCredit, resolveDisplayCity } from "@/lib/market/cities";

export const revalidate = 120;

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l   = isValidLang(lang) ? lang : "fr";
  const m   = SEO_META[l as SupportedLang];
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://belo-khaki.vercel.app";
  return {
    title: m.title, description: m.description, keywords: [...m.keywords],
    alternates: {
      canonical: `${base}/${l}`,
      languages: { fr: `${base}/fr`, en: `${base}/en`, "x-default": `${base}/fr` },
    },
    openGraph: { title: m.title, description: m.description, locale: m.locale, type: "website" },
  };
}

// ── Data fetchers ─────────────────────────────────────────────

async function getHomeData() {
  try {
    const [featured, trending, total] = await Promise.all([
      // Featured: top ranked active salons
      prisma.tenant.findMany({
        where:   { status: "ACTIVE", deletedAt: null },
        select:  {
          id: true, name: true, slug: true, city: true, plan: true, coverUrl: true,
          _count: { select: { bookings: true } },
          metrics:  { select: { ratingAvg: true } },
          trending: { select: { bookings24h: true, score: true } },
          services: { where: { isActive: true }, select: { priceCents: true }, orderBy: { priceCents: "asc" }, take: 1 },
        },
        orderBy: [{ plan: "desc" }, { createdAt: "desc" }],
        take:    8,
      }),
      // Trending: highest trending score
      prisma.tenantTrending.findMany({
        where:   { score: { gt: 0 }, tenant: { status: "ACTIVE", deletedAt: null } },
        include: {
          tenant: {
            select: {
              id: true, name: true, slug: true, city: true, plan: true, coverUrl: true,
              metrics:  { select: { ratingAvg: true } },
              services: { where: { isActive: true }, select: { priceCents: true }, orderBy: { priceCents: "asc" }, take: 1 },
            },
          },
        },
        orderBy: { score: "desc" },
        take:    8,
      }),
      prisma.tenant.count({ where: { status: "ACTIVE", deletedAt: null } }),
    ]);
    return { featured, trending, total };
  } catch {
    return { featured: [] as any[], trending: [] as any[], total: 0 };
  }
}

// ── Helpers ───────────────────────────────────────────────────

const CATEGORIES = [
  { slug: "hair",    emoji: "💇‍♀️", labelFr: "Coiffure",   labelEn: "Hair"      },
  { slug: "nails",   emoji: "💅",    labelFr: "Manucure",   labelEn: "Nails"     },
  { slug: "massage", emoji: "💆‍♀️", labelFr: "Massage",    labelEn: "Massage"   },
  { slug: "beauty",  emoji: "🧖‍♀️", labelFr: "Soins",      labelEn: "Beauty"    },
  { slug: "makeup",  emoji: "💄",    labelFr: "Maquillage", labelEn: "Makeup"    },
  { slug: "barber",  emoji: "✂️",    labelFr: "Barbershop", labelEn: "Barbershop"},
];

const TOP_CITIES = [
  { slug: "dakar",      name: "Dakar",      flag: "🇸🇳", desc: "Sénégal"    },
  { slug: "abidjan",    name: "Abidjan",    flag: "🇨🇮", desc: "Côte d'Ivoire" },
  { slug: "casablanca", name: "Casablanca", flag: "🇲🇦", desc: "Maroc"      },
  { slug: "paris",      name: "Paris",      flag: "🇫🇷", desc: "France"     },
  { slug: "bruxelles",  name: "Bruxelles",  flag: "🇧🇪", desc: "Belgique"   },
  { slug: "luxembourg", name: "Luxembourg", flag: "🇱🇺", desc: "Luxembourg" },
];

function toCardData(t: any): any {
  return {
    id:           t.id,
    name:         t.name,
    slug:         t.slug,
    city:         t.city,
    plan:         t.plan,
    coverUrl:     t.coverUrl,
    ratingAvg:    t.metrics?.ratingAvg ?? 5,
    bookings24h:  t.trending?.bookings24h ?? 0,
    trendingScore:t.trending?.score ?? 0,
    priceFrom:    t.services?.[0]?.priceCents ?? null,
    currency:     "XOF",
  };
}

// ── Page ──────────────────────────────────────────────────────

export default async function LandingPage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();

  const t                          = getTranslations(lang);
  const { featured, trending, total } = await getHomeData();
  const isFr                       = lang === "fr";
  const l                          = lang as SupportedLang;

  // ── Dynamic location credit — never hardcoded ─────────────
  // Vercel sets x-vercel-ip-country automatically (free tier).
  // Falls back to market-default city when header is missing (dev/SSG).
  const h        = await headers();
  const country  = h.get("x-vercel-ip-country") ?? undefined;
  const market   = detectMarket({ lang, country });
  const editorialCredit = buildEditorialCredit(
    { country, market, lang: isFr ? "fr" : "en" },
    total,
  );
  const displayCity = resolveDisplayCity({ country, market, lang: isFr ? "fr" : "en" });

  const trendingCards = trending.map((tr: any) => toCardData({ ...tr.tenant, trending: { bookings24h: tr.bookings24h, score: tr.score } }));
  const featuredCards = featured.map(toCardData);

  return (
    <>
      <PublicNav />
      <main className="bg-bg text-text min-h-screen">

        {/* ── HERO — éditorial beauté ────────────────────────── */}
        <section
          className="relative overflow-hidden pt-28 pb-20 px-5"
          style={{
            background: "linear-gradient(180deg, var(--cream) 0%, var(--blush) 100%)",
          }}
        >
          {/* Cinematic light system — three layered glows, slow breathing.
              Champagne center / soft-peach left / dusty-rose right.
              The breath is 18s — imperceptible to the conscious eye. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div
              className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full blur-3xl"
              style={{
                background: "radial-gradient(circle, rgba(217,194,176,.35) 0%, transparent 70%)",
                opacity:    0.6,
                animation:  "ambient-breathe 18s ease-in-out infinite",
              }}
            />
            <div
              className="absolute top-32 left-0 w-[420px] h-[420px] rounded-full blur-3xl"
              style={{
                background: "radial-gradient(circle, rgba(245,215,200,.22) 0%, transparent 65%)",
                opacity:    0.85,
                animation:  "ambient-breathe 22s ease-in-out infinite reverse",
                transform:  "translateX(-30%)",
              }}
            />
            <div
              className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-3xl"
              style={{
                background: "radial-gradient(circle, rgba(232,208,203,.18) 0%, transparent 65%)",
                opacity:    0.75,
                animation:  "ambient-breathe 26s ease-in-out infinite",
                transform:  "translate(20%, 20%)",
              }}
            />
          </div>

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            {/* Crédit éditorial — uppercase letter-spacing, sans pill */}
            <p
              className="text-[10px] uppercase tracking-[0.3em] mb-8 font-medium"
              style={{ color: "var(--warm-mute)" }}
            >
              {editorialCredit}
            </p>

            {/* Titre — Fraunces editorial, poids 600 (pas extrabold), italique pour l'accent */}
            <h1
              className="font-heading mb-6"
              style={{
                fontSize:    "clamp(2.5rem, 6vw, 4.5rem)",
                fontWeight:  600,
                lineHeight:  1.1,
                letterSpacing: "-0.015em",
                color:       "var(--text)",
              }}
            >
              {t("hero_title")}{" "}
              <span style={{ fontStyle: "italic", fontWeight: 600 }}>
                {t("hero_title2")}
              </span>
            </h1>

            <p
              className="text-base max-w-xl mx-auto mb-10"
              style={{
                color:      "var(--text2)",
                lineHeight: 1.7,
                fontWeight: 400,
              }}
            >
              {t("hero_desc")}
            </p>

            <SearchBar
              lang={l}
              placeholder={t("search_service")}
              cityPlaceholder={displayCity}
              buttonLabel={t("search_btn")}
              className="mb-8"
            />

            {/* Beauty universes — labels éditoriaux, non cliquables.
                Le texte communique l'univers, jamais une navigation. */}
            <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-3 mt-2">
              {CATEGORIES.map((cat, i) => (
                <span
                  key={cat.slug}
                  className="inline-flex items-center"
                >
                  <span
                    className="text-[12px] tracking-[0.04em] transition-opacity duration-[400ms]"
                    style={{
                      color:      "var(--text2)",
                      opacity:    0.72,
                      fontFamily: "var(--font-fraunces, var(--serif))",
                      fontWeight: 500,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {isFr ? cat.labelFr : cat.labelEn}
                  </span>
                  {i < CATEGORIES.length - 1 && (
                    <span
                      className="ml-5 text-[8px]"
                      style={{ color: "var(--warm-mute)", opacity: 0.4 }}
                      aria-hidden="true"
                    >
                      ●
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── 🔥 TRENDING ───────────────────────────────────── */}
        {trendingCards.length > 0 && (
          <section className="px-5 py-10 max-w-6xl mx-auto" aria-label={isFr ? "Tendances" : "Trending"}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-heading text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
                  {isFr ? "Très demandés" : "Most loved"}
                </h2>
                <p className="text-xs mt-1 uppercase tracking-[0.18em]" style={{ color: "var(--warm-mute)" }}>
                  {isFr ? "Sélection du jour" : "Today's edit"}
                </p>
              </div>
              <Link href={`/${lang}/salons`} className="text-g2 text-sm font-semibold hover:text-g3 hidden sm:block">
                {t("see_all")}
              </Link>
            </div>
            <div className="flex gap-6 overflow-x-auto pb-3 -mx-1 px-1 no-scrollbar">
              {trendingCards.map((salon: any) => (
                <div key={salon.id} className="shrink-0 w-[200px] sm:w-[220px]">
                  <SalonCard salon={salon} lang={lang} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── ✨ FEATURED / RECOMMENDED ─────────────────────── */}
        <section className="px-5 py-10 bg-card2/30">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-heading text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
                  {isFr ? "Nos coups de cœur" : "Editor's picks"}
                </h2>
                <p className="text-xs mt-1 uppercase tracking-[0.18em]" style={{ color: "var(--warm-mute)" }}>
                  {isFr ? "Choisis avec soin" : "Hand-picked"}
                </p>
              </div>
              <Link href={`/${lang}/salons`} className="text-g2 text-sm font-semibold hover:text-g3">
                {t("see_all")}
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
              {featuredCards.length === 0
                ? Array.from({ length: 4 }).map((_, i) => <SalonCardSkeleton key={i} />)
                : featuredCards.slice(0, 8).map((salon: any) => (
                    <SalonCard key={salon.id} salon={salon} lang={lang} />
                  ))
              }
            </div>
          </div>
        </section>

        {/* ── BEAUTY UNIVERSES — moods éditoriaux, jamais des liens ─
            La rangée n'est PAS une navigation. Aucun Link, aucun arrow.
            Pure typographie magazine : un univers beauté par label. */}
        <section className="px-5 py-20 max-w-5xl mx-auto" aria-label={isFr ? "Univers beauté" : "Beauty universes"}>
          <h2
            className="font-heading text-3xl font-semibold mb-2 text-center"
            style={{ color: "var(--text)", letterSpacing: "-0.015em" }}
          >
            {isFr ? "Univers beauté" : "Beauty universes"}
          </h2>
          <p className="text-xs uppercase tracking-[0.18em] text-center mb-14" style={{ color: "var(--warm-mute)" }}>
            {isFr ? "Pour chaque rituel" : "For every ritual"}
          </p>

          {/* Layout éditorial — libre, respirant, jamais une grille de boutons */}
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8">
            {CATEGORIES.map(cat => (
              <span
                key={cat.slug}
                className="inline-block text-center transition-opacity duration-[400ms]"
                style={{
                  opacity:       0.72,
                  fontFamily:    "var(--font-fraunces, var(--serif))",
                  fontWeight:    500,
                  fontSize:      18,
                  color:         "var(--text)",
                  letterSpacing: "-0.01em",
                  // Pas d'interaction — pas de cursor, pas de hover navigation
                  cursor:        "default",
                }}
              >
                {isFr ? cat.labelFr : cat.labelEn}
              </span>
            ))}
          </div>
        </section>

        {/* ── TOP CITIES ────────────────────────────────────── */}
        <section className="px-5 py-12 bg-card2/30">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-serif text-xl font-bold mb-2 text-center">
              {isFr ? "Réservez dans votre ville" : "Book in your city"}
            </h2>
            <p className="text-text3 text-sm text-center mb-8">
              {isFr ? "Afrique · Europe · Monde" : "Africa · Europe · World"}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {TOP_CITIES.map(city => (
                <Link
                  key={city.slug}
                  href={`/${lang}/salons/${city.slug}`}
                  className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border text-center hover:border-g2/40 hover:bg-g2/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft"
                >
                  <span className="text-3xl" aria-hidden="true">{city.flag}</span>
                  <span className="text-sm font-semibold group-hover:text-g2 transition-colors">{city.name}</span>
                  <span className="text-text3 text-[10px]">{city.desc}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────── */}
        <section className="px-5 py-16 max-w-5xl mx-auto">
          <h2 className="font-serif text-3xl font-extrabold text-center mb-3">{t("how_title")}</h2>
          <p className="text-text2 text-center mb-12 max-w-lg mx-auto">{t("how_sub")}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {([
              ["🔍", t("step1_title"), t("step1_desc"), t("step1_time"), "from-g2/20 to-g1/10"],
              ["🕐", t("step2_title"), t("step2_desc"), t("step2_time"), "from-blue/20 to-blue/5"],
              ["💳", t("step3_title"), t("step3_desc"), t("step3_time"), "from-amber/20 to-amber/5"],
              ["✅", t("step4_title"), t("step4_desc"), t("step4_time"), "from-g2/20 to-g1/10"],
            ] as [string, string, string, string, string][]).map(([icon, title, desc, time, grad], i) => (
              <div key={i} className="relative text-center p-6 rounded-2xl bg-card border border-border hover:border-g2/30 hover:shadow-soft transition-all duration-200">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-2xl mx-auto mb-4`} aria-hidden="true">{icon}</div>
                <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-g1 text-white text-xs font-bold flex items-center justify-center shadow-green" aria-hidden="true">{i + 1}</div>
                <h3 className="font-serif font-semibold text-sm mb-2">{title}</h3>
                <p className="text-text3 text-xs leading-relaxed mb-3">{desc}</p>
                <span className="inline-block text-[10px] font-semibold text-g2 bg-g2/10 border border-g2/20 px-3 py-1 rounded-full">{time}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOR SALONS CTA ────────────────────────────────── */}
        <section className="px-5 py-12 bg-gradient-to-br from-g1/10 via-card2/50 to-card border-y border-border">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-8">
            <div className="flex-1 text-center sm:text-left">
              <p className="text-g2 text-xs font-bold uppercase tracking-widest mb-3">
                ✦ {isFr ? "Vous êtes gérant de salon ?" : "Are you a salon owner?"}
              </p>
              <h2 className="font-serif text-2xl font-extrabold mb-3">
                {isFr ? "Recevez plus de clients automatiquement" : "Get more clients automatically"}
              </h2>
              <p className="text-text2 text-sm mb-5">
                {isFr ? "Rejoignez Belo gratuitement. Actif en 5 minutes." : "Join Belo for free. Live in 5 minutes."}
              </p>
              <Link
                href={`/${lang}/for-salons`}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-g1 text-white font-semibold text-sm hover:bg-g3 transition-colors shadow-green"
              >
                {isFr ? "Créer mon salon gratuitement →" : "Create my salon for free →"}
              </Link>
            </div>
            <div className="text-7xl sm:text-8xl" aria-hidden="true">💅</div>
          </div>
        </section>

        {/* ── FOOTER — éditorial, silencieux ────────────────── */}
        <footer className="px-5 pt-20 pb-12">
          <div className="max-w-5xl mx-auto">
            {/* Séparateur très subtil — hairline, pas une border */}
            <div
              className="h-px w-full mb-12 mx-auto max-w-md"
              style={{ background: "var(--border)" }}
            />

            <div className="flex flex-col items-center text-center gap-6">
              <div
                className="font-heading text-2xl"
                style={{ color: "var(--text)", fontWeight: 600, letterSpacing: "-0.02em" }}
              >
                belo<span style={{ color: "var(--color-primary)" }}>.</span>
              </div>

              <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-[12px]">
                {[
                  [isFr ? "Accueil"         : "Home",         `/${lang}`],
                  [isFr ? "Salons"          : "Salons",       `/${lang}/salons`],
                  [isFr ? "Tarifs"          : "Pricing",      `/${lang}/plans`],
                  [isFr ? "Pour les salons" : "For salons",   `/${lang}/for-salons`],
                  [isFr ? "Confidentialité" : "Privacy",      `/${lang}/legal/privacy`],
                  [isFr ? "Conditions"      : "Terms",        `/${lang}/legal/terms`],
                  [isFr ? "Cookies"         : "Cookies",      `/${lang}/legal/cookies`],
                ].map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    className="transition-opacity duration-300"
                    style={{ color: "var(--warm-mute)", opacity: 0.85 }}
                  >
                    {label}
                  </Link>
                ))}
              </nav>

              <LangSwitcher currentLang={lang} />

              <p className="text-[11px] mt-8 tracking-wide" style={{ color: "var(--warm-mute)" }}>
                © 2026 Belo · {t("footer_tagline")}
              </p>
              <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: "var(--warm-mute)" }}>
                Dakar · Paris · Bruxelles
              </p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
