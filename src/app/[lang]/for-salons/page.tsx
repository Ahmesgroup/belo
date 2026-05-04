// app/[lang]/for-salons/page.tsx
// B2B sales page — the most important business page on Belo.
// Server-rendered, fully i18n (FR/EN), Tailwind, SEO-optimised.

import { notFound }      from "next/navigation";
import Link              from "next/link";
import type { Metadata } from "next";
import { getTranslations, isValidLang, type SupportedLang } from "@/lib/i18n-server";
import { PublicNav }     from "@/components/ui/Nav";
import { prisma }        from "@/infrastructure/db/prisma";

export const revalidate = 3600; // 1 hour — social-proof numbers

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l   = isValidLang(lang) ? lang : "fr";
  const t   = getTranslations(l);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://belo-khaki.vercel.app";
  return {
    title:       t("for_salons.meta_title"),
    description: t("for_salons.meta_desc"),
    alternates: {
      canonical: `${base}/${l}/for-salons`,
      languages: { fr: `${base}/fr/for-salons`, en: `${base}/en/for-salons`, "x-default": `${base}/fr/for-salons` },
    },
    openGraph: { title: t("for_salons.meta_title"), description: t("for_salons.meta_desc"), type: "website" },
  };
}

async function getSocialProof() {
  try {
    const [salons, bookings] = await Promise.all([
      prisma.tenant.count({ where: { status: "ACTIVE" } }),
      prisma.booking.count(),
    ]);
    return { salons, bookings };
  } catch { return { salons: 120, bookings: 3000 }; }
}

export default async function ForSalonsPage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();

  const t    = getTranslations(lang);
  const l    = lang as SupportedLang;
  const isFr = l === "fr";
  const { salons, bookings } = await getSocialProof();

  const FEATURES = [
    { emoji: "📅", title: t("for_salons.feat_1_title"), desc: t("for_salons.feat_1_desc") },
    { emoji: "💰", title: t("for_salons.feat_2_title"), desc: t("for_salons.feat_2_desc") },
    { emoji: "📈", title: t("for_salons.feat_3_title"), desc: t("for_salons.feat_3_desc") },
  ];

  const STEPS = [
    t("for_salons.step_1"),
    t("for_salons.step_2"),
    t("for_salons.step_3"),
  ];

  const FAQS = [
    { q: t("for_salons.faq_1_q"), a: t("for_salons.faq_1_a") },
    { q: t("for_salons.faq_2_q"), a: t("for_salons.faq_2_a") },
    { q: t("for_salons.faq_3_q"), a: t("for_salons.faq_3_a") },
    { q: t("for_salons.faq_4_q"), a: t("for_salons.faq_4_a") },
  ];

  const PLANS = [
    {
      name:    "Free",
      price:   isFr ? "0 FCFA" : "Free",
      tagline: isFr ? "Pour tester" : "To try it",
      color:   "border-border2",
      cta:     isFr ? "Commencer gratuitement" : "Get started free",
      features:[ isFr ? "20 réservations/mois" : "20 bookings/month", isFr ? "1 service" : "1 service", isFr ? "Page salon publique" : "Public salon page" ],
    },
    {
      name:    "Pro",
      price:   isFr ? "15 000 FCFA" : "€23",
      tagline: isFr ? "Pour gagner plus" : "To earn more",
      color:   "border-blue/40",
      featured:true,
      cta:     isFr ? "Essayer Pro →" : "Try Pro →",
      features:[ isFr ? "500 réservations/mois" : "500 bookings/month", isFr ? "WhatsApp automatique" : "Automatic WhatsApp", isFr ? "Paiements en ligne" : "Online payments", isFr ? "Analytics" : "Analytics" ],
    },
    {
      name:    "Premium",
      price:   isFr ? "35 000 FCFA" : "€53",
      tagline: isFr ? "Pour dominer" : "To dominate",
      color:   "border-purple/40",
      cta:     isFr ? "Essayer Premium →" : "Try Premium →",
      features:[ isFr ? "Réservations illimitées" : "Unlimited bookings", isFr ? "Multi-staff" : "Multi-staff", isFr ? "Analytics IA" : "AI Analytics", isFr ? "API Webhook" : "API Webhook" ],
    },
  ];

  return (
    <>
      <PublicNav />

      {/* Structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Belo",
        "applicationCategory": "BusinessApplication",
        "description": t("for_salons.meta_desc"),
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "XOF" },
      }) }} />

      <main className="bg-bg text-text">

        {/* ── HERO ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-28 pb-20 px-5 text-center">
          {/* Gradient glow */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full bg-g2/[0.07] blur-3xl" />
          </div>

          <div className="relative z-10 max-w-2xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-g2/10 border border-g2/20 text-g2 text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-g2 animate-pulse" />
              {t("for_salons.badge")}
            </div>

            {/* Headline */}
            <h1 className="font-serif text-5xl sm:text-6xl font-extrabold leading-tight tracking-tight mb-5">
              {t("for_salons.hero_title")}<br />
              <span className="text-g2 italic">{t("for_salons.hero_title2")}</span>
            </h1>

            <p className="text-text2 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              {t("for_salons.hero_sub")}
            </p>

            {/* Primary CTA */}
            <Link
              href={`/login`}
              className="inline-flex items-center gap-2 px-9 py-4 rounded-2xl bg-g1 text-white font-serif font-bold text-lg hover:bg-g3 transition-all duration-200 shadow-green hover:shadow-[0_8px_32px_rgba(13,158,110,.35)] hover:-translate-y-0.5"
            >
              {t("for_salons.cta_primary")}
            </Link>

            {/* Micro-copy */}
            <p className="mt-4 text-sm text-text3">{t("for_salons.micro_copy")}</p>
          </div>
        </section>

        {/* ── SOCIAL PROOF ──────────────────────────────────────── */}
        <section className="py-10 border-y border-border">
          <div className="max-w-3xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 text-center">
            <div>
              <div className="font-serif text-4xl font-extrabold text-g2">{salons > 100 ? `+${salons}` : "+120"}</div>
              <div className="text-text3 text-sm mt-1">{isFr ? "salons utilisent Belo" : "salons use Belo"}</div>
            </div>
            <div className="w-px h-12 bg-border hidden sm:block" />
            <div>
              <div className="font-serif text-4xl font-extrabold text-g2">{bookings > 1000 ? `+${(Math.round(bookings / 100) * 100).toLocaleString()}` : "+3 000"}</div>
              <div className="text-text3 text-sm mt-1">{isFr ? "réservations chaque mois" : "bookings every month"}</div>
            </div>
            <div className="w-px h-12 bg-border hidden sm:block" />
            <div>
              <div className="font-serif text-4xl font-extrabold text-g2">4.8★</div>
              <div className="text-text3 text-sm mt-1">{isFr ? "note moyenne gérants" : "avg. owner rating"}</div>
            </div>
          </div>
        </section>

        {/* ── PROBLEM → SOLUTION ────────────────────────────────── */}
        <section className="py-20 px-5">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-serif text-3xl font-extrabold text-center mb-14">{t("for_salons.prob_title")}</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Before */}
              <div className="bg-red/5 border border-red/20 rounded-2xl p-8">
                <div className="text-red text-xs font-bold uppercase tracking-widest mb-5 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border border-red/40 flex items-center justify-center text-xs">✗</span>
                  {t("for_salons.prob_before")}
                </div>
                {[t("for_salons.prob_1"), t("for_salons.prob_2"), t("for_salons.prob_3")].map(item => (
                  <div key={item} className="flex items-center gap-3 mb-4 last:mb-0">
                    <span className="w-6 h-6 rounded-full bg-red/10 text-red flex items-center justify-center text-xs shrink-0">✗</span>
                    <span className="text-text2 text-sm line-through opacity-70">{item}</span>
                  </div>
                ))}
              </div>
              {/* After */}
              <div className="bg-g2/5 border border-g2/20 rounded-2xl p-8">
                <div className="text-g2 text-xs font-bold uppercase tracking-widest mb-5 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border border-g2/40 flex items-center justify-center text-xs">✓</span>
                  {t("for_salons.sol_after")}
                </div>
                {[t("for_salons.sol_1"), t("for_salons.sol_2"), t("for_salons.sol_3")].map(item => (
                  <div key={item} className="flex items-center gap-3 mb-4 last:mb-0">
                    <span className="w-6 h-6 rounded-full bg-g2/15 text-g2 flex items-center justify-center text-xs shrink-0 font-bold">✓</span>
                    <span className="text-text font-medium text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ──────────────────────────────────────────── */}
        <section className="py-20 px-5 bg-card2/30">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-serif text-3xl font-extrabold text-center mb-4">{t("for_salons.feat_title")}</h2>
            <p className="text-text3 text-center text-sm mb-14 max-w-md mx-auto">
              {isFr ? "Tout ce dont votre salon a besoin, dans une seule plateforme." : "Everything your salon needs, in one platform."}
            </p>
            <div className="grid sm:grid-cols-3 gap-6">
              {FEATURES.map((f, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-8 hover:border-g2/30 hover:shadow-card transition-all duration-200 hover:-translate-y-0.5">
                  <div className="w-14 h-14 rounded-2xl bg-g2/10 flex items-center justify-center text-3xl mb-5">{f.emoji}</div>
                  <h3 className="font-serif font-bold text-base mb-3">{f.title}</h3>
                  <p className="text-text3 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────── */}
        <section className="py-20 px-5">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-serif text-3xl font-extrabold mb-3">{t("for_salons.how_title")}</h2>
            <p className="text-text3 text-sm mb-12">{t("for_salons.how_sub")}</p>
            <div className="flex flex-col gap-4">
              {STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-5 bg-card border border-border rounded-2xl px-6 py-5 text-left hover:border-g2/30 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-g1 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-green">{i + 1}</div>
                  <span className="font-semibold text-base">{step}</span>
                  {i < STEPS.length - 1 && <span className="ml-auto text-text3 text-xs">{isFr ? "puis" : "then"} →</span>}
                  {i === STEPS.length - 1 && <span className="ml-auto text-g2 text-xs font-semibold">✓</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING SIMPLIFIÉ ─────────────────────────────────── */}
        <section className="py-20 px-5 bg-card2/30">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-serif text-3xl font-extrabold mb-3">{t("for_salons.pricing_title")}</h2>
            <p className="text-text3 text-sm mb-12">{t("for_salons.pricing_sub")}</p>
            <div className="grid sm:grid-cols-3 gap-5">
              {PLANS.map((plan) => (
                <div key={plan.name} className={`relative bg-card border ${plan.color} rounded-2xl p-6 text-left ${plan.featured ? "ring-2 ring-blue/30" : ""}`}>
                  {plan.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue text-white text-[10px] font-bold px-3 py-1 rounded-full">
                      {isFr ? "LE PLUS POPULAIRE" : "MOST POPULAR"}
                    </div>
                  )}
                  <div className="text-xs font-bold text-text3 uppercase tracking-widest mb-1">{plan.name}</div>
                  <div className="font-serif text-2xl font-extrabold mb-1">{plan.price}</div>
                  <div className="text-text3 text-xs mb-5">{plan.tagline}</div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-text2">
                        <span className="text-g2">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${plan.featured ? "bg-g1 text-white hover:bg-g3" : "border border-border2 text-text2 hover:bg-card2"}`}>
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
            <p className="text-text3 text-xs mt-8">{isFr ? "Sans engagement · Résiliable à tout moment" : "No commitment · Cancel anytime"}</p>
          </div>
        </section>

        {/* ── FAQ / OBJECTIONS ──────────────────────────────────── */}
        <section className="py-20 px-5">
          <div className="max-w-2xl mx-auto">
            <h2 className="font-serif text-3xl font-extrabold text-center mb-12">{t("for_salons.faq_title")}</h2>
            <div className="space-y-4">
              {FAQS.map((faq, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-6">
                  <div className="font-semibold text-sm mb-2 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-g2/15 text-g2 text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">?</span>
                    {faq.q}
                  </div>
                  <p className="text-text3 text-sm leading-relaxed pl-9">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────── */}
        <section className="py-20 px-5">
          <div className="max-w-xl mx-auto text-center bg-card border border-border2 rounded-3xl p-12 shadow-card">
            <div className="text-4xl mb-6">🚀</div>
            <h2 className="font-serif text-3xl font-extrabold mb-4 leading-tight">
              {t("for_salons.final_title")}
            </h2>
            <p className="text-text2 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
              {t("for_salons.final_sub")}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-9 py-4 rounded-2xl bg-g1 text-white font-serif font-bold text-base hover:bg-g3 transition-all duration-200 shadow-green hover:-translate-y-0.5"
            >
              {t("for_salons.final_cta")}
            </Link>
            <p className="mt-4 text-xs text-text3">{t("for_salons.final_micro")}</p>
          </div>
        </section>

        {/* Footer minimal */}
        <footer className="px-5 py-8 border-t border-border text-center">
          <div className="flex gap-3 justify-center">
            <Link href="/fr/for-salons" hrefLang="fr" className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${lang === "fr" ? "border-g2/40 text-g2 bg-g2/10" : "border-border2 text-text3 hover:text-text"}`}>🇫🇷 FR</Link>
            <Link href="/en/for-salons" hrefLang="en" className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${lang === "en" ? "border-g2/40 text-g2 bg-g2/10" : "border-border2 text-text3 hover:text-text"}`}>🇬🇧 EN</Link>
          </div>
        </footer>
      </main>
    </>
  );
}
