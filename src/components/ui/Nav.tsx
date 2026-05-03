"use client";
import { useState, useEffect } from "react";
import { useLang } from "@/hooks/useLang";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUser, clearAuth } from "@/lib/auth-client";

export function PublicNav() {
  const { lang, setLang, t } = useLang();
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
            <button onClick={()=>setLang(lang==="fr"?"en":"fr")} title="Change language"
              style={{background:"transparent",border:"1px solid var(--border2)",borderRadius:8,padding:"5px 9px",fontSize:12,fontWeight:600,cursor:"pointer",color:"var(--text2)",lineHeight:1,flexShrink:0,minWidth:38}}>
              {lang==="fr"?"EN":"FR"}
            </button>
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
    { href: "/dashboard",          icon: "▦",  label: "Dashboard",      badge: 0 },
    { href: "/dashboard/bookings", icon: "📅", label: "Réservations",   badge: notifCount },
    { href: "/dashboard/services", icon: "✂️", label: "Services",       badge: 0 },
    { href: "/dashboard/horaires", icon: "🕐", label: "Horaires",       badge: 0 },
    { href: "/dashboard/profil",   icon: "👤", label: "Mon profil",     badge: 0 },
    ...(plan === "PREMIUM" ? [{ href: "/dashboard/equipe", icon: "👥", label: "Équipe", badge: 0 }] : []),
  ];

  const planColors: Record<string, string> = {
    FREE: "var(--text3)",
    PRO: "var(--blue)",
    PREMIUM: "var(--purple)",
  };

  return (
    <aside style={{
      width: mobile ? "100%" : 220,
      background: "var(--card2)",
      borderRight: mobile ? "none" : `1px solid ${plan === "PREMIUM" ? "rgba(144,96,232,.2)" : "var(--border)"}`,
      display: "flex", flexDirection: "column", flexShrink: 0,
      height: mobile ? "auto" : "100vh",
      position: mobile ? "relative" : "sticky",
      top: 0, overflowY: "auto",
    }}>
      <div style={{padding:"16px",display:"flex",alignItems:"center",gap:9,borderBottom:"1px solid var(--border)"}}>
        <div style={{width:30,height:30,background:"linear-gradient(135deg,var(--g),#074030)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✦</div>
        <div>
          <div style={{fontFamily:"var(--serif)",fontWeight:800,fontSize:15}}>
            belo<span style={{color:"var(--g2)"}}>.</span>
          </div>
          <div style={{fontSize:9,color:"var(--text3)",letterSpacing:".06em"}}>Gérant</div>
        </div>
      </div>

      <div style={{
        margin:"10px 12px 0",padding:"6px 10px",
        background: plan==="FREE" ? "rgba(255,255,255,.04)" : plan==="PRO" ? "rgba(59,126,246,.08)" : "rgba(144,96,232,.08)",
        border: `1px solid ${plan==="FREE" ? "var(--border2)" : plan==="PRO" ? "rgba(59,126,246,.2)" : "rgba(144,96,232,.25)"}`,
        borderRadius:10,fontSize:10,fontWeight:700,
        color: planColors[plan],
        letterSpacing:".06em",textAlign:"center",
      }}>
        {plan === "FREE" ? "🌱 Plan Gratuit" : plan === "PRO" ? "🚀 Plan Pro" : "✦ Plan Premium"}
      </div>

      <nav style={{padding:"10px 8px",flex:1}}>
        {links.map(({ href, icon, label, badge }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} onClick={onClose} style={{
              display:"flex",alignItems:"center",gap:9,
              padding: mobile ? "16px 12px" : "8px 10px",
              borderRadius:8,
              fontSize: mobile ? 15 : 12,
              color: active ? "var(--g2)" : "var(--text3)",
              background: active ? "rgba(34,211,138,.1)" : "transparent",
              textDecoration:"none",marginBottom:2,transition:".15s",
              borderLeft: active ? "3px solid var(--g2)" : "3px solid transparent",
              position: "relative",
            }}>
              <span style={{fontSize:mobile?18:13,width:17,textAlign:"center"}}>{icon}</span>
              <span style={{flex:1}}>{label}</span>
              {badge > 0 && (
                <span style={{
                  minWidth:16,height:16,borderRadius:99,
                  background:"var(--red)",color:"#fff",
                  fontSize:9,fontWeight:700,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  padding:"0 4px",
                }}>
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
