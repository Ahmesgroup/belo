// /[lang]/salons/[city]/[category] — combined SEO page
// e.g. /fr/salons/dakar/coiffure  /en/salons/paris/massage

import { notFound }     from "next/navigation";
import Link             from "next/link";
import type { Metadata } from "next";
import { getTranslations, isValidLang, type SupportedLang } from "@/lib/i18n-server";
import { getLocalized }  from "@/lib/i18n-localize";
import { PublicNav }     from "@/components/ui/Nav";
import { prisma }        from "@/infrastructure/db/prisma";

export const revalidate = 600;

type Props = {
  params: Promise<{ lang: string; city: string; category: string }>;
};

const CATEGORY_META: Record<string, { labelFr: string; labelEn: string; emoji: string }> = {
  hair:    { labelFr: "Coiffure",   labelEn: "Hair salon",  emoji: "💇‍♀️" },
  nails:   { labelFr: "Manucure",   labelEn: "Nail salon",  emoji: "💅" },
  massage: { labelFr: "Massage",    labelEn: "Massage",     emoji: "💆‍♀️" },
  beauty:  { labelFr: "Soins visage",labelEn: "Beauty care",emoji: "🧖‍♀️" },
  makeup:  { labelFr: "Maquillage", labelEn: "Makeup",      emoji: "💄" },
  barber:  { labelFr: "Barbershop", labelEn: "Barbershop",  emoji: "✂️" },
  spa:     { labelFr: "Spa",        labelEn: "Spa",         emoji: "🏊‍♀️" },
  waxing:  { labelFr: "Épilation",  labelEn: "Waxing",      emoji: "🧴" },
};

export async function generateStaticParams() {
  const langs      = ["fr", "en"];
  const categories = Object.keys(CATEGORY_META);
  const cities     = await prisma.city.findMany({ where: { isActive: true }, select: { slug: true } }).catch(() => []);
  return langs.flatMap(lang =>
    cities.flatMap(c => categories.map(cat => ({ lang, city: c.slug, category: cat })))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, city, category } = await params;
  const l   = isValidLang(lang) ? lang : "fr";
  const isFr = l === "fr";
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://belo-khaki.vercel.app";

  const catMeta  = CATEGORY_META[category];
  const cityRecord = await prisma.city.findUnique({ where: { slug: city }, include: { country: true } }).catch(() => null);
  const cityName   = cityRecord ? getLocalized(cityRecord.name as Record<string, string>, l, city) : city;
  const catLabel   = catMeta ? (isFr ? catMeta.labelFr : catMeta.labelEn) : category;

  const title = isFr
    ? `${catLabel} à ${cityName} — Salons Belo`
    : `${catLabel} in ${cityName} — Belo Salons`;
  const description = isFr
    ? `Réservez les meilleurs salons de ${catLabel.toLowerCase()} à ${cityName}. Confirmation WhatsApp instantanée.`
    : `Book the best ${catLabel.toLowerCase()} salons in ${cityName}. Instant WhatsApp confirmation.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${l}/salons/${city}/${category}`,
      languages: {
        fr: `${base}/fr/salons/${city}/${category}`,
        en: `${base}/en/salons/${city}/${category}`,
        "x-default": `${base}/fr/salons/${city}/${category}`,
      },
    },
    openGraph: { title, description, type: "website" },
  };
}

const planBadge = (p: string) =>
  p === "PREMIUM" ? "★ Premium" :
  p === "PRO"     ? "⚡ PRO" : null;

export default async function CityCategPage({ params }: Props) {
  const { lang, city, category } = await params;
  if (!isValidLang(lang)) notFound();

  const catMeta = CATEGORY_META[category];
  if (!catMeta) notFound();

  const t    = getTranslations(lang);
  const isFr = lang === "fr";
  const l    = lang as SupportedLang;

  const cityRecord = await prisma.city.findUnique({
    where:   { slug: city },
    include: { country: true },
  }).catch(() => null);

  if (!cityRecord) notFound();

  const cityName = getLocalized(cityRecord.name as Record<string, string>, l, city);
  const catLabel = isFr ? catMeta.labelFr : catMeta.labelEn;
  const base     = process.env.NEXT_PUBLIC_APP_URL ?? "https://belo-khaki.vercel.app";

  const cityVariants = [cityName, city, city.replace(/-/g, " ")];
  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where: {
        status:    "ACTIVE",
        deletedAt: null,
        OR:        cityVariants.map(v => ({ city: { contains: v, mode: "insensitive" as const } })),
        services:  { some: { category, isActive: true } },
      },
      select: { id: true, name: true, slug: true, city: true, plan: true, coverUrl: true, _count: { select: { bookings: true } } },
      orderBy: [{ plan: "desc" }, { createdAt: "desc" }],
      take: 24,
    }),
    prisma.tenant.count({
      where: {
        status: "ACTIVE", deletedAt: null,
        OR: cityVariants.map(v => ({ city: { contains: v, mode: "insensitive" as const } })),
        services: { some: { category, isActive: true } },
      },
    }),
  ]);

  return (
    <>
      <PublicNav />
      <main className="bg-bg text-text min-h-screen pt-16">

        {/* Structured data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": `${catLabel} à ${cityName}`,
          "url": `${base}/${lang}/salons/${city}/${category}`,
          "numberOfItems": total,
        }) }} />

        <div className="max-w-6xl mx-auto px-5 py-12">
          {/* Breadcrumb */}
          <nav aria-label="breadcrumb" className="flex items-center gap-2 text-xs text-text3 mb-8">
            <Link href={`/${lang}`} className="hover:text-g2 transition-colors">{isFr ? "Accueil" : "Home"}</Link>
            <span>/</span>
            <Link href={`/${lang}/salons`} className="hover:text-g2 transition-colors">{t("all_salons")}</Link>
            <span>/</span>
            <Link href={`/${lang}/salons/${city}`} className="hover:text-g2 transition-colors capitalize">{cityName}</Link>
            <span>/</span>
            <span className="text-text">{catLabel}</span>
          </nav>

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-4xl">{catMeta.emoji}</span>
              <h1 className="font-serif text-3xl font-extrabold">
                {isFr ? `${catLabel} à ${cityName}` : `${catLabel} in ${cityName}`}
              </h1>
            </div>
            <p className="text-text3 text-sm">
              {total} {total !== 1 ? t("salons_count_pl") : t("salons_count")}
              {" · "} {getLocalized(cityRecord.country.name as Record<string, string>, l, "")}
            </p>
          </div>

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap mb-8">
            {Object.entries(CATEGORY_META).map(([slug, m]) => (
              <Link
                key={slug}
                href={`/${lang}/salons/${city}/${slug}`}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-semibold transition-all ${
                  slug === category
                    ? "bg-g2/10 border-g2/40 text-g2"
                    : "border-border2 text-text3 hover:border-g2/30 hover:text-text"
                }`}
              >
                {m.emoji} {isFr ? m.labelFr : m.labelEn}
              </Link>
            ))}
          </div>

          {/* Grid */}
          {tenants.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-text3 mb-4">
                {isFr ? `Aucun salon de ${catLabel.toLowerCase()} à ${cityName} pour l'instant.` : `No ${catLabel.toLowerCase()} salons in ${cityName} yet.`}
              </p>
              <Link href={`/${lang}/salons/${city}`} className="text-g2 text-sm hover:underline">
                {isFr ? `Voir tous les salons à ${cityName} →` : `Browse all salons in ${cityName} →`}
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {tenants.map(s => (
                <div key={s.id} className="group rounded-2xl bg-card border border-border overflow-hidden hover:border-g2/30 hover:shadow-card transition-all duration-200 hover:-translate-y-0.5">
                  <div className="relative h-44 bg-gradient-to-br from-[#1a2a1a] to-[#0d2d1a] overflow-hidden">
                    {s.coverUrl
                      ? <img src={s.coverUrl} alt={s.name} className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" />
                      : <div className="absolute inset-0 flex items-center justify-center text-5xl">{catMeta.emoji}</div>
                    }
                    {planBadge(s.plan) && (
                      <span className={`absolute top-3 right-3 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${s.plan === "PREMIUM" ? "bg-purple/20 text-purple" : "bg-amber/20 text-amber"}`}>
                        {planBadge(s.plan)}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-sm truncate mb-1">{s.name}</h3>
                    {s.city && <p className="text-text3 text-xs mb-3">📍 {s.city}</p>}
                    <Link
                      href={`/booking/${s.slug}`}
                      className="block w-full text-center py-2 rounded-xl text-sm font-semibold bg-g1 text-white hover:bg-g3 transition-colors"
                    >
                      {t("salon_book")}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cross-links to other categories in this city */}
          <div className="mt-16 pt-10 border-t border-border">
            <h2 className="font-serif text-lg font-bold mb-4">
              {isFr ? `Autres prestations à ${cityName}` : `Other services in ${cityName}`}
            </h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CATEGORY_META).filter(([s]) => s !== category).map(([slug, m]) => (
                <Link key={slug} href={`/${lang}/salons/${city}/${slug}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-border2 text-text3 text-xs font-semibold hover:border-g2/30 hover:text-text transition-all">
                  {m.emoji} {isFr ? m.labelFr : m.labelEn}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
