// app/[lang]/plans/page.tsx — Pricing page (server metadata + client toggle)

import { notFound }      from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, isValidLang, type SupportedLang } from "@/lib/i18n-server";
import { PublicNav }     from "@/components/ui/Nav";
import PlansClient       from "./PlansClient";

export const revalidate = 300;
type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l   = isValidLang(lang) ? lang : "fr";
  const t   = getTranslations(l);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://belo-khaki.vercel.app";
  return {
    title: t("plans.meta_title"),
    description: t("plans.meta_desc"),
    alternates: {
      canonical: `${base}/${l}/plans`,
      languages: { fr: `${base}/fr/plans`, en: `${base}/en/plans`, "x-default": `${base}/fr/plans` },
    },
  };
}

export default async function PlansPage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();

  const t = getTranslations(lang);
  const l = lang as SupportedLang;

  // All labels resolved server-side — passed to client component as plain strings
  const labels = {
    monthly: t("plans.monthly"), annual: t("plans.annual"),
    free_label: t("plans.free_label"), per_month: t("plans.per_month"),
    recommended: t("plans.recommended"), no_commitment: t("plans.no_commitment"),
    plans: {
      free:    { name: t("plans.free_name"),  tagline: t("plans.free_tagline"),  cta: t("plans.free_cta")  },
      pro:     { name: t("plans.pro_name"),   tagline: t("plans.pro_tagline"),   cta: t("plans.pro_cta")   },
      premium: { name: t("plans.prem_name"),  tagline: t("plans.prem_tagline"),  cta: t("plans.prem_cta")  },
    },
    feats: {
      feat_bookings_free: t("plans.feat_bookings_free"), feat_bookings_pro:  t("plans.feat_bookings_pro"),
      feat_bookings_prem: t("plans.feat_bookings_prem"), feat_services_free: t("plans.feat_services_free"),
      feat_services_pro:  t("plans.feat_services_pro"),  feat_services_prem: t("plans.feat_services_prem"),
      feat_photos_free:   t("plans.feat_photos_free"),   feat_photos_pro:    t("plans.feat_photos_pro"),
      feat_photos_prem:   t("plans.feat_photos_prem"),   feat_whatsapp_pro:  t("plans.feat_whatsapp_pro"),
      feat_whatsapp_prem: t("plans.feat_whatsapp_prem"), feat_deposit_pro:   t("plans.feat_deposit_pro"),
      feat_deposit_prem:  t("plans.feat_deposit_prem"),  feat_analytics_pro: t("plans.feat_analytics_pro"),
      feat_analytics_prem:t("plans.feat_analytics_prem"),feat_social:        t("plans.feat_social"),
      feat_multistaff:    t("plans.feat_multistaff"),    feat_api:           t("plans.feat_api"),
      feat_address:       t("plans.feat_address"),
    },
  };

  return (
    <>
      <PublicNav />
      <main className="bg-bg text-text min-h-screen pt-16">
        <div className="text-center pt-12 pb-2 px-5">
          <h1 className="font-serif text-4xl sm:text-5xl font-extrabold mb-4">{t("plans.title")}</h1>
          <p className="text-text2 text-base max-w-lg mx-auto">{t("plans.subtitle")}</p>
        </div>
        <PlansClient lang={lang} labels={labels} initialPrices={{}} />
      </main>
    </>
  );
}
