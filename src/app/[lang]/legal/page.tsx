// /[lang]/legal — index landing of legal & trust pages.

import Link from "next/link";
import type { Metadata } from "next";
import { isValidLang, type SupportedLang } from "@/lib/i18n-server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l = isValidLang(lang) ? lang : "fr";
  return {
    title:       l === "fr" ? "Mentions légales | Belo" : "Legal notices | Belo",
    description: l === "fr"
      ? "Confidentialité, conditions, cookies et droits RGPD chez Belo."
      : "Privacy, terms, cookies and GDPR rights at Belo.",
    robots: { index: true, follow: true },
  };
}

const CONTENT_FR = {
  intro: "Toutes les mentions légales et politiques de Belo en un seul endroit. Chaque page est rédigée pour être claire, calme et accessible.",
  sections: [
    { slug: "privacy", title: "Confidentialité", desc: "Comment nous traitons vos données personnelles." },
    { slug: "terms",   title: "Conditions",      desc: "Les règles d'utilisation de Belo, simplement." },
    { slug: "cookies", title: "Cookies",         desc: "Ce que nous stockons sur votre appareil, et pourquoi." },
    { slug: "gdpr",    title: "RGPD",            desc: "Vos droits — accès, rectification, suppression, portabilité." },
  ],
  contact: "Une question ? Écrivez-nous à",
};

const CONTENT_EN = {
  intro: "All of Belo's legal pages and policies in one place. Each one is written to be clear, calm and accessible.",
  sections: [
    { slug: "privacy", title: "Privacy",  desc: "How we handle your personal data." },
    { slug: "terms",   title: "Terms",    desc: "The rules for using Belo, simply." },
    { slug: "cookies", title: "Cookies",  desc: "What we store on your device, and why." },
    { slug: "gdpr",    title: "GDPR",     desc: "Your rights — access, rectification, deletion, portability." },
  ],
  contact: "A question? Write to us at",
};

export default async function LegalIndexPage({ params }: Props) {
  const { lang } = await params;
  const l    = isValidLang(lang) ? lang : "fr";
  const c    = l === "fr" ? CONTENT_FR : CONTENT_EN;
  const isFr = l === "fr";

  return (
    <>
      <h1>{isFr ? "Mentions" : "Notices"}</h1>
      <p className="text-lg" style={{ color: "var(--text2)" }}>{c.intro}</p>

      <div className="mt-12 space-y-10">
        {c.sections.map(s => (
          <Link
            key={s.slug}
            href={`/${l}/legal/${s.slug}`}
            className="block group"
          >
            <h2 className="transition-opacity duration-500 group-hover:opacity-70">
              {s.title}
            </h2>
            <p style={{ color: "var(--text2)" }}>{s.desc}</p>
          </Link>
        ))}
      </div>

      <p className="mt-20" style={{ color: "var(--warm-mute)" }}>
        {c.contact}{" "}
        <a href="mailto:legal@belo.sn">legal@belo.sn</a>.
      </p>
    </>
  );
}
