"use client";
import { useState, useEffect } from "react";
import { useLang } from "@/hooks/useLang";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUser, clearAuth } from "@/lib/auth-client";
import { LangSwitcher } from "./LangSwitcher";

export function PublicNav() {
  const { lang, t } = useLang();
  const [user,     setUser]     = useState<{ name?: string; role?: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (u) setUser(u);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function logout() {
    clearAuth();
    setUser(null);
    window.location.href = "/";
  }

  const [theme, setTheme] = useState<"dark"|"light">("light");

  useEffect(() => {
    const saved = (localStorage.getItem("belo_theme") ?? "light") as "dark"|"light";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("belo_theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  const initial      = user?.name?.charAt(0).toUpperCase() ?? "?";
  const role         = user?.role ?? "";
  const destAccount  = role === "OWNER" || role === "STAFF" ? "/dashboard"
    : role === "SUPER_ADMIN" || role === "ADMIN" ? "/admin"
    : "/profil";
  const accountLabel = role === "OWNER" || role === "STAFF" ? t("nav_dashboard")
    : role === "SUPER_ADMIN" || role === "ADMIN" ? t("nav_admin")
    : t("nav_account");

  return (
    <>
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:500,background:"var(--nav-bg)",backdropFilter:"blur(20px)",borderBottom:"1px solid var(--border)",padding:"0 5vw"}}>
        <div style={{display:"flex",alignItems:"center",height:56,maxWidth:1200,margin:"0 auto",gap:0}}>
          <Link href="/" style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:700,color:"var(--text)",textDecoration:"none",marginRight:32,whiteSpace:"nowrap"}}>
            belo<span style={{color:"var(--g2)"}}>.</span>
          </Link>
          {!isMobile && (
            <div style={{display:"flex",gap:4,flex:1,overflowX:"auto",scrollbarWidth:"none"}}>
              {[
                [t("nav_discover"),  "/salons"],
                [t("nav_how"),       "/#how"],
                [t("nav_salons"),    "/pour-les-salons"],
              ].map(([label,href]) => (
                <Link key={href} href={href} style={{padding:"6px 12px",borderRadius:8,fontSize:12,color:"var(--text3)",textDecoration:"none",transition:".2s",whiteSpace:"nowrap"}}>
                  {label}
                </Link>
              ))}
            </div>
          )}
          {isMobile && <div style={{flex:1}} />}
          <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:12}}>
            <button onClick={toggleTheme} title={theme==="dark"?"Mode clair":"Mode sombre"}
              style={{background:"transparent",border:"1px solid var(--border2)",borderRadius:8,padding:"6px 9px",fontSize:14,cursor:"pointer",color:"var(--text2)",lineHeight:1,flexShrink:0}}>
              {theme==="dark" ? "☀️" : "🌙"}
            </button>
            {/* URL-based language switcher — same logic as footer */}
            <LangSwitcher currentLang={lang} style={{ flexShrink: 0 }} />

            {user ? (
              <>
                <Link href={destAccount} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 12px",borderRadius:9,fontSize:12,fontWeight:600,background:"rgba(34,211,138,.1)",border:"1px solid rgba(34,211,138,.2)",color:"var(--g2)",textDecoration:"none"}}>
                  <span style={{width:22,height:22,borderRadius:"50%",background:"var(--g2)",color:"#111",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>{initial}</span>
                  {!isMobile && accountLabel}
                </Link>
                <button onClick={logout} style={{padding:"7px 14px",borderRadius:9,fontSize:12,fontWeight:600,background:"transparent",border:"1px solid var(--border2)",color:"var(--text3)",cursor:"pointer"}}>
                  {t("nav_logout")}
                </button>
              </>
            ) : (
              <Link href="/login" style={{padding:"7px 16px",borderRadius:9,fontSize:12,fontWeight:600,background:"transparent",border:"1px solid var(--border2)",color:"var(--text2)",textDecoration:"none"}}>
                {t("nav_login")}
              </Link>
            )}
            <Link href="/salons" style={{padding:"7px 16px",borderRadius:9,fontSize:12,fontWeight:600,background:"var(--g)",color:"#fff",textDecoration:"none"}}>
              {t("nav_book")}
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}

// ── DashboardNav — atelier beauté, jamais admin SaaS ──────────
// Surfaces crème, typographie éditoriale, icônes line-art SVG,
// transitions lentes, aucun emoji marketplace.

// SVG line icons — stroke 1.4, organic, never aggressive
const ICON_DASH = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6"  cy="6"  r="1.4" /><circle cx="12" cy="6"  r="1.4" /><circle cx="18" cy="6"  r="1.4" />
    <circle cx="6"  cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" />
    <circle cx="6"  cy="18" r="1.4" /><circle cx="12" cy="18" r="1.4" /><circle cx="18" cy="18" r="1.4" />
  </svg>
);
const ICON_CAL = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3.5 10h17" />
  </svg>
);
const ICON_SCISSORS = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6"  cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" />
  </svg>
);
const ICON_CLOCK = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);
const ICON_PORTRAIT = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="9" r="3.5" />
    <path d="M5 21c0-4 3.2-7 7-7s7 3 7 7" />
  </svg>
);
const ICON_TEAM = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="9" r="3.2" />
    <path d="M3 20c0-3.2 2.7-5.8 6-5.8s6 2.6 6 5.8" />
    <circle cx="17" cy="10" r="2.6" />
    <path d="M16.5 14.4c2.6.4 4.5 2.5 4.5 5.6" />
  </svg>
);

const PLAN_LABEL: Record<string, string> = {
  FREE:    "Free",
  PRO:     "Pro",
  PREMIUM: "Premium",
};

export function DashboardNav({
  plan = "FREE",
  mobile = false,
  onClose,
  notifCount = 0,
}: {
  plan?: "FREE" | "PRO" | "PREMIUM";
  mobile?: boolean;
  onClose?: () => void;
  notifCount?: number;
}) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard",          icon: ICON_DASH,     label: "Atelier",       badge: 0 },
    { href: "/dashboard/bookings", icon: ICON_CAL,      label: "Réservations",  badge: notifCount },
    { href: "/dashboard/services", icon: ICON_SCISSORS, label: "Soins",         badge: 0 },
    { href: "/dashboard/horaires", icon: ICON_CLOCK,    label: "Horaires",      badge: 0 },
    { href: "/dashboard/profil",   icon: ICON_PORTRAIT, label: "Mon salon",     badge: 0 },
    ...(plan === "PREMIUM" ? [{ href: "/dashboard/equipe", icon: ICON_TEAM, label: "Équipe", badge: 0 }] : []),
  ];

  return (
    <aside style={{
      width: mobile ? "100%" : 240,
      background: "var(--cream)",
      // Hairline shadow remplace la borderRight dure
      boxShadow: mobile ? "none" : "1px 0 0 rgba(67,42,28,.05)",
      display: "flex", flexDirection: "column", flexShrink: 0,
      height: mobile ? "auto" : "100vh",
      position: mobile ? "relative" : "sticky",
      top: 0, overflowY: "auto",
    }}>
      {/* ── Wordmark — éditorial ────────────────────────────── */}
      <div style={{ padding: "28px 24px 22px" }}>
        <div style={{
          fontFamily: "var(--font-fraunces, var(--serif))",
          fontWeight: 600,
          fontSize:   22,
          letterSpacing: "-0.02em",
          color:      "var(--text)",
          lineHeight: 1,
        }}>
          belo<span style={{ color: "var(--g2)" }}>.</span>
        </div>
        <div style={{
          marginTop: 6,
          fontSize:  10,
          color:     "var(--warm-mute)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
        }}>
          Atelier
        </div>
      </div>

      {/* ── Plan — texte uniquement, sans encadré coloré ────── */}
      <div style={{
        padding: "0 24px 18px",
      }}>
        <div style={{
          fontSize:      9,
          color:         "var(--warm-mute)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
        }}>
          Plan
        </div>
        <div style={{
          fontFamily:    "var(--font-fraunces, var(--serif))",
          fontWeight:    600,
          fontSize:      14,
          color:         "var(--text)",
          letterSpacing: "-0.01em",
          marginTop:     2,
        }}>
          {PLAN_LABEL[plan]}
        </div>
      </div>

      {/* Séparateur hairline — mx-6 */}
      <div style={{
        margin:     "0 24px 8px",
        height:     1,
        background: "rgba(67,42,28,.06)",
      }} aria-hidden="true" />

      {/* ── Navigation — items éditoriaux ────────────────────── */}
      <nav style={{ padding: "8px 12px", flex: 1 }}>
        {links.map(({ href, icon, label, badge }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} onClick={onClose} style={{
              display:        "flex",
              alignItems:     "center",
              gap:            14,
              padding:        mobile ? "14px 12px" : "10px 12px",
              borderRadius:   14,
              fontSize:       mobile ? 15 : 13,
              fontFamily:     "var(--font-fraunces, var(--serif))",
              fontWeight:     active ? 600 : 500,
              letterSpacing:  "-0.005em",
              color:          active ? "var(--text)" : "var(--warm-mute)",
              background:     active ? "var(--warm-cream)" : "transparent",
              textDecoration: "none",
              marginBottom:   2,
              transition:     "color 350ms ease, background 350ms ease",
              position:       "relative",
            }}>
              <span style={{ color: active ? "var(--text)" : "var(--warm-mute)", display: "flex" }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {badge > 0 && (
                <span style={{
                  minWidth:      18,
                  height:        18,
                  borderRadius:  99,
                  background:    "var(--blush)",
                  color:         "var(--text)",
                  fontSize:      10,
                  fontWeight:    600,
                  display:       "flex",
                  alignItems:    "center",
                  justifyContent:"center",
                  padding:       "0 6px",
                  letterSpacing: "0",
                }}>
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer éditorial du sidebar ──────────────────────── */}
      <div style={{
        padding: "16px 24px 24px",
        fontSize: 10,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: "var(--warm-mute)",
      }}>
        Studio · Dakar
      </div>
    </aside>
  );
}
