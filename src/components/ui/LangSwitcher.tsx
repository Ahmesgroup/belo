"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SUPPORTED_LANGS, type SupportedLang } from "@/lib/i18n-server";

interface LangSwitcherProps {
  /** The currently active language code. */
  currentLang: string;
  /** Additional styles for the wrapper. */
  style?: React.CSSProperties;
}

/**
 * URL-based language switcher.
 * Replaces the /[lang]/ segment in the current URL when switching.
 * Falls back to prefixing the path with /[newLang] when not on a lang route.
 */
export function LangSwitcher({ currentLang, style }: LangSwitcherProps) {
  const pathname = usePathname();

  function buildHref(newLang: SupportedLang): string {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length > 0 && SUPPORTED_LANGS.includes(segments[0] as SupportedLang)) {
      segments[0] = newLang;
      return "/" + segments.join("/");
    }
    return `/${newLang}${pathname === "/" ? "" : pathname}`;
  }

  return (
    <div style={{ display: "flex", gap: 4, ...style }}>
      {SUPPORTED_LANGS.map(lang => {
        const isActive = lang === currentLang;
        return (
          <Link
            key={lang}
            href={buildHref(lang)}
            title={lang === "fr" ? "Version française" : "English version"}
            style={{
              padding: "5px 9px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: isActive ? 700 : 600,
              cursor: isActive ? "default" : "pointer",
              background: isActive ? "rgba(34,211,138,.12)" : "transparent",
              border: `1px solid ${isActive ? "rgba(34,211,138,.3)" : "var(--border2)"}`,
              color: isActive ? "var(--g2)" : "var(--text2)",
              textDecoration: "none",
              lineHeight: 1,
              minWidth: 36,
              textAlign: "center" as const,
              transition: ".15s",
            }}
          >
            {lang.toUpperCase()}
          </Link>
        );
      })}
    </div>
  );
}
