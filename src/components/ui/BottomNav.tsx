"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { tap } from "@/lib/motion/presets";
import { MOTION } from "@/lib/motion/motion";
import { getIntentColor } from "@/lib/design/intent";

interface NavItem {
  href:  string;
  label: string;
  icon:  (active: boolean) => React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href:  "/",
    label: "Accueil",
    icon:  (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
          stroke={active ? getIntentColor("cta") : "currentColor"}
          strokeWidth="1.8"
          strokeLinejoin="round"
          fill={active ? "rgba(29,185,84,.15)" : "none"}
        />
      </svg>
    ),
  },
  {
    href:  "/salons",
    label: "Recherche",
    icon:  (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle
          cx="11"
          cy="11"
          r="7"
          stroke={active ? getIntentColor("cta") : "currentColor"}
          strokeWidth="1.8"
        />
        <path
          d="M20 20l-3-3"
          stroke={active ? getIntentColor("cta") : "currentColor"}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href:  "/profil",
    label: "Réservations",
    icon:  (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect
          x="3"
          y="4"
          width="18"
          height="17"
          rx="2"
          stroke={active ? getIntentColor("cta") : "currentColor"}
          strokeWidth="1.8"
        />
        <path
          d="M8 2v4M16 2v4M3 10h18"
          stroke={active ? getIntentColor("cta") : "currentColor"}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href:  "/profil",
    label: "Profil",
    icon:  (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12"
          cy="8"
          r="4"
          stroke={active ? getIntentColor("cta") : "currentColor"}
          strokeWidth="1.8"
        />
        <path
          d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
          stroke={active ? getIntentColor("cta") : "currentColor"}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/" || pathname.startsWith("/fr") || pathname.startsWith("/en");
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)", // CRITIQUE iPhone
      }}
    >
      <div
        className="flex items-center justify-around px-2 pt-2 pb-1"
        style={{
          backgroundColor:    "rgba(255,255,255,.80)",
          backdropFilter:     "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop:          "1px solid rgba(0,0,0,.08)",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);

          return (
            <motion.div
              key={`${item.href}-${item.label}`}
              whileTap={tap}
              className="flex-1"
            >
              <Link
                href={item.href}
                className="flex flex-col items-center gap-0.5 py-1 relative"
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                {/* Icône */}
                <span
                  className="transition-colors"
                  style={{
                    color: active ? getIntentColor("cta") : "#6B7280",
                  }}
                >
                  {item.icon(active)}
                </span>

                {/* Label */}
                <span
                  className="text-[10px] font-medium transition-colors"
                  style={{
                    color: active ? getIntentColor("cta") : "#6B7280",
                  }}
                >
                  {item.label}
                </span>

                {/* Dot actif vert sous le tab */}
                {active && (
                  <motion.span
                    layoutId="nav-dot"
                    className="absolute -bottom-0.5 w-1 h-1 rounded-full"
                    style={{ backgroundColor: getIntentColor("cta") }}
                    transition={{
                      duration: MOTION.duration.ui,
                      ease:     MOTION.easing,
                    }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </nav>
  );
}
