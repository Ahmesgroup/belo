/**
 * Shared layout for /[lang]/legal/*  pages.
 * Editorial reading experience — warm cream surface, generous spacing,
 * soft serif headlines. No legal-wall feeling, no dense paragraphs.
 *
 * Trust must feel emotional, not bureaucratic.
 */

import Link from "next/link";
import { PublicNav } from "@/components/ui/Nav";
import { LangSwitcher } from "@/components/ui/LangSwitcher";
import { getTranslations, isValidLang, type SupportedLang } from "@/lib/i18n-server";

type Props = {
  children: React.ReactNode;
  params:   Promise<{ lang: string }>;
};

const SECTIONS_FR = [
  { slug: "privacy",  label: "Confidentialité" },
  { slug: "terms",    label: "Conditions"      },
  { slug: "cookies",  label: "Cookies"         },
  { slug: "gdpr",     label: "RGPD"            },
];

const SECTIONS_EN = [
  { slug: "privacy",  label: "Privacy" },
  { slug: "terms",    label: "Terms"   },
  { slug: "cookies",  label: "Cookies" },
  { slug: "gdpr",     label: "GDPR"    },
];

export default async function LegalLayout({ children, params }: Props) {
  const { lang } = await params;
  const l        = isValidLang(lang) ? (lang as SupportedLang) : "fr";
  const t        = getTranslations(l);
  const isFr     = l === "fr";
  const sections = isFr ? SECTIONS_FR : SECTIONS_EN;

  return (
    <>
      <PublicNav />
      <main
        className="min-h-screen pt-28 pb-24"
        style={{ color: "var(--text)" }}
      >
        <div className="max-w-3xl mx-auto px-6">

          {/* ── Eyebrow — éditorial credit ─────────────────── */}
          <p
            className="text-[10px] uppercase tracking-[0.3em] mb-8"
            style={{ color: "var(--warm-mute)" }}
          >
            {isFr ? "Belo · Mentions" : "Belo · Notices"}
          </p>

          {/* ── Section nav — silent inline ────────────────── */}
          <nav className="flex flex-wrap gap-x-5 gap-y-2 mb-16" aria-label={isFr ? "Mentions légales" : "Legal sections"}>
            {sections.map(s => (
              <Link
                key={s.slug}
                href={`/${l}/legal/${s.slug}`}
                className="text-[12px] tracking-wide transition-opacity duration-300"
                style={{
                  fontFamily: "var(--font-fraunces, var(--serif))",
                  fontWeight: 500,
                  color:      "var(--text2)",
                  opacity:    0.72,
                }}
              >
                {s.label}
              </Link>
            ))}
          </nav>

          {/* ── Page content (editorial reading) ───────────── */}
          <article className="legal-reading">
            {children}
          </article>

          {/* ── Footer — silencieux ─────────────────────────── */}
          <div
            className="mt-24 pt-12 flex flex-col items-center gap-4 text-center"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <Link
              href={`/${l}`}
              className="text-[12px] transition-opacity duration-300"
              style={{
                fontFamily: "var(--font-fraunces, var(--serif))",
                fontWeight: 500,
                color:      "var(--text)",
                opacity:    0.85,
              }}
            >
              {isFr ? "← Retour à Belo" : "← Back to Belo"}
            </Link>
            <LangSwitcher currentLang={l} />
            <p className="text-[11px]" style={{ color: "var(--warm-mute)" }}>
              {t("footer_tagline")}
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
