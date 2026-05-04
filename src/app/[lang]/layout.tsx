// ============================================================
// app/[lang]/layout.tsx — Localised nested layout
//
// Handles SEO for every /fr/* and /en/* page:
//   • generateMetadata: per-language title/description/OG
//   • alternates.languages: hreflang tags (FR, EN, x-default)
//   • canonical: absolute URL per language
//   • LangSync: syncs the URL lang with the client-side LangContext
//
// This is a SERVER COMPONENT (no "use client").
// It does NOT add <html> or <body> — those stay in app/layout.tsx.
// ============================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidLang, SUPPORTED_LANGS, SEO_META, type SupportedLang } from "@/lib/i18n-server";
import LangSync from "@/components/LangSync";

type Props = {
  children: React.ReactNode;
  params:   Promise<{ lang: string }>;
};

// Pre-render /fr and /en at build time.
export function generateStaticParams() {
  return SUPPORTED_LANGS.map(lang => ({ lang }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l        = isValidLang(lang) ? lang : "fr";
  const meta     = SEO_META[l as SupportedLang];
  const base     = process.env.NEXT_PUBLIC_APP_URL ?? "https://belo-khaki.vercel.app";

  return {
    title: {
      default:  meta.title,
      template: meta.titleTemplate,
    },
    description: meta.description,
    keywords:    [...meta.keywords],
    alternates: {
      canonical: `${base}/${l}`,
      languages: {
        fr:          `${base}/fr`,
        en:          `${base}/en`,
        "x-default": `${base}/fr`,
      },
    },
    openGraph: {
      title:       meta.title,
      description: meta.description,
      locale:      meta.locale,
      type:        "website",
      url:         `${base}/${l}`,
      siteName:    "Belo",
    },
    twitter: {
      card:        "summary_large_image",
      title:       meta.title,
      description: meta.description,
    },
    robots: {
      index:  true,
      follow: true,
    },
  };
}

export default async function LangLayout({ children, params }: Props) {
  const { lang } = await params;

  // Return 404 for any path segment that is not a supported language
  if (!isValidLang(lang)) notFound();

  return (
    <>
      {/*
        LangSync is a thin client component that fires setLang(lang) on mount,
        keeping the client-side LangContext in sync with the URL.
        It renders null — no visible output.
      */}
      <LangSync lang={lang as SupportedLang} />
      {children}
    </>
  );
}
