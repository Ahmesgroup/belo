/**
 * app/(city-seo)/[city]/[category]/page.tsx
 *
 * Pages SEO locales — ex : /dakar/coiffeur
 *
 * Route group (city-seo) : évite le conflit avec [lang] au même niveau.
 * Les URLs sont /[city]/[category] sans le préfixe du groupe.
 *
 * RÈGLES :
 * - Générée seulement si salons >= 3 actifs (évite les pages fines)
 * - Utile SANS login obligatoire
 * - Slots = dynamiques (Suspense), contenu = statique (SSG)
 * - Aucune donnée fictive dans le schema JSON-LD
 */

import { Suspense }                  from "react";
import { notFound }                  from "next/navigation";
import type { Metadata }             from "next";
import { prisma }                    from "@/infrastructure/db/prisma";
import { SalonList, type ListSalon } from "@/components/home/SalonList";
import { SalonListSeoClient }        from "./SalonListSeoClient";

// ── TYPES ─────────────────────────────────────────────────────

interface PageParams {
  city:     string;
  category: string;
}

// ── LANG CODES — ne pas générer des pages pour ces slugs ──────
// Évite que /fr/coiffeur soit interprété comme city=fr
const LANG_CODES = new Set(["fr", "en", "ar", "wo"]);

// ── LABEL FORMATTERS ──────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  coiffeur:          "coiffeur",
  "coiffeur-plateau": "coiffeur plateau",
  barber:            "barbier",
  braids:            "tresses africaines",
  nails:             "manucure & ongles",
  spa:               "spa & bien-être",
  makeup:            "maquillage",
  massage:           "massage",
};

const CITY_LABELS: Record<string, string> = {
  dakar:       "Dakar",
  thies:       "Thiès",
  saint_louis: "Saint-Louis",
  kaolack:     "Kaolack",
};

function getCityLabel(city: string): string {
  return CITY_LABELS[city] ?? city.charAt(0).toUpperCase() + city.slice(1);
}

function getCategoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

// ── generateStaticParams ──────────────────────────────────────
// PHASE 1 : Dakar uniquement (autres villes = phase 2)
// Génère seulement si >= 3 salons actifs (évite les pages fines)

export async function generateStaticParams(): Promise<PageParams[]> {
  const PHASE_1_CITIES = ["dakar"];

  const results: PageParams[] = [];

  for (const city of PHASE_1_CITIES) {
    // Récupérer les catégories actives dans cette ville
    const groups = await prisma.service.groupBy({
      by:     ["category"],
      where: {
        isActive: true,
        tenant:   {
          city:   { equals: city, mode: "insensitive" },
          status: "ACTIVE",
        },
      },
      having: {
        // Proxy pour >= 3 salons : au moins 3 services distincts
        category: { _count: { gte: 3 } },
      },
    }).catch(() => []);

    for (const g of groups) {
      const slug = g.category.toLowerCase().replace(/\s+/g, "-");
      results.push({ city, category: slug });
    }
  }

  return results;
}

// ── generateMetadata ──────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { city, category } = params;
  const cityLabel     = getCityLabel(city);
  const categoryLabel = getCategoryLabel(category);

  const title       = `Réserver un ${categoryLabel} à ${cityLabel} | Belo`;
  const description =
    `Trouvez et réservez les meilleurs salons de ${categoryLabel} à ${cityLabel}. ` +
    `Confirmation instantanée, paiement Wave / Orange Money.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type:   "website",
      locale: "fr_SN",
      siteName: "Belo",
    },
    twitter: {
      card:        "summary",
      title,
      description,
    },
    alternates: {
      canonical: `/${city}/${category}`,
    },
  };
}

// ── DATA FETCHING ─────────────────────────────────────────────

async function getSalons(city: string, category: string): Promise<ListSalon[]> {
  const tenants = await prisma.tenant.findMany({
    where: {
      status:   "ACTIVE",
      city:     { equals: city, mode: "insensitive" },
      services: {
        some: {
          isActive: true,
          category: { equals: category, mode: "insensitive" },
        },
      },
    },
    select: {
      id:       true,
      name:     true,
      slug:     true,
      city:     true,
      photos:   true,
      coverUrl: true,
      services: {
        where:  { isActive: true },
        select: { priceCents: true, category: true },
        orderBy: { priceCents: "asc" },
        take:    1,
      },
      metrics:  {
        select: { ratingAvg: true },
      },
      _count: {
        select: { bookings: true },
      },
    },
    orderBy: [{ plan: "desc" }, { createdAt: "desc" }],
    take:    20,
  });

  return tenants.map((t) => ({
    id:            t.id,
    name:          t.name,
    city:          t.city ?? city,
    slug:          t.slug,
    rating:        t.metrics?.ratingAvg ?? 4.5,
    minPriceCents: t.services[0]?.priceCents ?? 0,
    category:      category,
    isAvailable:   true, // slots dynamiques — chargés côté client
    photoUrl:      t.coverUrl ?? t.photos[0] ?? undefined,
  }));
}

// ── JSON-LD SCHEMA ────────────────────────────────────────────

/**
 * RÈGLE ABSOLUE SEO :
 * Aucune donnée fictive dans le schema.
 * Absence > mensonge. Google croise avec Maps et autres sources.
 */

interface SalonWithSchema {
  id:          string;
  name:        string;
  city:        string | null;
  address:     string | null;
  phone:       string | null;
  rating:      number | null;
  reviewCount: number;
  services:    Array<{ name: string; priceCents: number }>;
  slug:        string;
}

function buildRatingSchema(salon: SalonWithSchema) {
  // Minimum 5 avis pour afficher le rating (sinon données non-significatives)
  if (!salon.rating || salon.reviewCount < 5) return undefined;
  return {
    "@type":       "AggregateRating",
    ratingValue:   salon.rating,
    reviewCount:   salon.reviewCount,
    bestRating:    5,
    worstRating:   1,
  };
}

function buildSalonSchema(salon: SalonWithSchema, city: string, category: string) {
  const ratingSchema = buildRatingSchema(salon);

  const offerCatalog = salon.services.length > 0
    ? {
        "@type": "OfferCatalog",
        name:    `Services ${getCategoryLabel(category)}`,
        itemListElement: salon.services.map((s) => ({
          "@type":       "Offer",
          itemOffered:   { "@type": "Service", name: s.name },
          priceCurrency: "XOF",
          price:         s.priceCents, // toujours en centimes = XOF
          availability:  "https://schema.org/InStock",
        })),
      }
    : undefined;

  const schema: Record<string, unknown> = {
    "@context":   "https://schema.org",
    "@type":      "BeautySalon",
    name:          salon.name,
    url:           `https://belo.sn/booking/${salon.slug}`,
    address: salon.address
      ? {
          "@type":           "PostalAddress",
          streetAddress:     salon.address,
          addressLocality:   getCityLabel(city),
          addressCountry:    "SN",
        }
      : undefined,
    telephone: salon.phone ?? undefined,
  };

  if (ratingSchema)   schema.aggregateRating = ratingSchema;
  if (offerCatalog)  schema.hasOfferCatalog  = offerCatalog;

  // Supprimer les undefined pour JSON propre
  return JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
}

async function getSalonsWithSchema(city: string, category: string) {
  return prisma.tenant.findMany({
    where: {
      status:   "ACTIVE",
      city:     { equals: city, mode: "insensitive" },
      services: { some: { isActive: true, category: { equals: category, mode: "insensitive" } } },
    },
    select: {
      id:      true,
      name:    true,
      city:    true,
      address: true,
      phone:   true,
      slug:    true,
      metrics: { select: { ratingAvg: true } },
      services: {
        where:   { isActive: true },
        select:  { name: true, priceCents: true },
        take:    5,
      },
      _count: { select: { bookings: true } },
    },
    take: 10,
  });
}

// ── SKELETON ──────────────────────────────────────────────────

function SlotsSkeleton() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 px-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex-shrink-0 w-20 h-10 rounded-xl bg-card2 animate-pulse"
        />
      ))}
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────

export default async function CityPage({ params }: { params: PageParams }) {
  const { city, category } = params;

  // Guard : rejeter les codes de langue comme city param
  if (LANG_CODES.has(city.toLowerCase())) notFound();

  const [salons, salonsSchema] = await Promise.all([
    getSalons(city, category),
    getSalonsWithSchema(city, category),
  ]);

  // Page utile seulement si >= 3 salons actifs
  if (salons.length < 3) notFound();

  const cityLabel     = getCityLabel(city);
  const categoryLabel = getCategoryLabel(category);

  // Schema JSON-LD uniquement avec données réelles
  const schemas = salonsSchema.map((s) =>
    buildSalonSchema(
      {
        ...s,
        rating:      s.metrics?.ratingAvg ?? null,
        reviewCount: s._count.bookings,
      },
      city,
      category,
    )
  );

  return (
    <>
      {/* JSON-LD — données strictement réelles */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context":    "https://schema.org",
            "@type":       "ItemList",
            name:          `Salons de ${categoryLabel} à ${cityLabel}`,
            numberOfItems: salons.length,
            itemListElement: schemas.map((s, i) => ({
              "@type":    "ListItem",
              position:   i + 1,
              item:       s,
            })),
          }),
        }}
      />

      <main className="min-h-screen bg-bg pb-24">
        {/* H1 visible et naturel */}
        <header className="px-4 pt-8 pb-6">
          <h1 className="font-bold text-2xl text-text leading-tight">
            {categoryLabel.charAt(0).toUpperCase() + categoryLabel.slice(1)} à{" "}
            {cityLabel}
          </h1>
          <p className="text-text3 text-sm mt-1">
            {salons.length} salon{salons.length > 1 ? "s" : ""} disponible
            {salons.length > 1 ? "s" : ""}
          </p>
        </header>

        {/* Slots disponibles — dynamiques, non bloquants */}
        <section className="mb-4">
          <h2 className="px-4 text-xs font-semibold text-text3 uppercase tracking-widest mb-2">
            Créneaux disponibles
          </h2>
          <Suspense fallback={<SlotsSkeleton />}>
            <SalonListSeoClient city={city} category={category} />
          </Suspense>
        </section>

        {/* Liste des salons — SSG, immédiatement disponible */}
        <section className="px-4">
          <h2 className="text-xs font-semibold text-text3 uppercase tracking-widest mb-3">
            Tous les salons
          </h2>
          <SalonList salons={salons} layout="vertical" />
        </section>
      </main>
    </>
  );
}
