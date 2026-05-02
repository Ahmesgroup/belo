"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function PublicNav() {
  const [user,     setUser]     = useState<{ name?: string; role?: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("belo_user");
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function logout() {
    localStorage.removeItem("belo_user");
    localStorage.removeItem("belo_token");
    setUser(null);
    window.location.href = "/";
  }

  const [theme, setTheme] = useState<"dark"|"light">("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("belo_theme") ?? "dark") as "dark"|"light";
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
  const accountLabel = role === "OWNER" || role === "STAFF" ? "Mon dashboard"
    : role === "SUPER_ADMIN" || role === "ADMIN" ? "Admin"
    : "Mon compte";

  return (
    <>
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:500,background:"rgba(6,9,13,.96)",backdropFilter:"blur(20px)",borderBottom:"1px solid var(--border)",padding:"0 5vw"}}>
        <div style={{display:"flex",alignItems:"center",height:56,maxWidth:1200,margin:"0 auto",gap:0}}>
          <Link href="/" style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:700,color:"var(--text)",textDecoration:"none",marginRight:32,whiteSpace:"nowrap"}}>
            belo<span style={{color:"var(--g2)"}}>.</span>
          </Link>
          {!isMobile && (
            <div style={{display:"flex",gap:4,flex:1,overflowX:"auto",scrollbarWidth:"none"}}>
              {[["Découvrir","/salons"],["Comment ça marche","/#how"],["Pour les salons","/plans"]].map(([label,href]) => (
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
            {user ? (
              <>
                <Link href={destAccount} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 12px",borderRadius:9,fontSize:12,fontWeight:600,background:"rgba(34,211,138,.1)",border:"1px solid rgba(34,211,138,.2)",color:"var(--g2)",textDecoration:"none"}}>
                  <span style={{width:22,height:22,borderRadius:"50%",background:"var(--g2)",color:"#111",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>{initial}</span>
                  {!isMobile && accountLabel}
                </Link>
                <button onClick={logout} style={{padding:"7px 14px",borderRadius:9,fontSize:12,fontWeight:600,background:"transparent",border:"1px solid var(--border2)",color:"var(--text3)",cursor:"pointer"}}>
                  Déconnexion
                </button>
              </>
            ) : (
              <Link href="/login" style={{padding:"7px 16px",borderRadius:9,fontSize:12,fontWeight:600,background:"transparent",border:"1px solid var(--border2)",color:"var(--text2)",textDecoration:"none"}}>
                Connexion
              </Link>
            )}
            <Link href="/salons" style={{padding:"7px 16px",borderRadius:9,fontSize:12,fontWeight:600,background:"var(--g)",color:"#fff",textDecoration:"none"}}>
              Réserver →
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}

export function DashboardNav({ plan = "FREE" }: { plan?: "FREE" | "PRO" | "PREMIUM" }) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard",          icon: "▦",  label: "Dashboard" },
    { href: "/dashboard/bookings", icon: "📅", label: "Réservations" },
    { href: "/dashboard/services", icon: "✂️", label: "Services" },
    { href: "/dashboard/horaires", icon: "🕐", label: "Horaires" },
    { href: "/dashboard/profil",   icon: "👤", label: "Mon profil" },
    ...(plan === "PREMIUM" ? [{ href: "/dashboard/equipe", icon: "👥", label: "Équipe" }] : []),
  ];

  const planColors: Record<string, string> = {
    FREE: "var(--text3)",
    PRO: "var(--blue)",
    PREMIUM: "var(--purple)",
  };

  return (
    <aside style={{
      width: 220, background: "var(--card2)",
      borderRight: `1px solid ${plan === "PREMIUM" ? "rgba(144,96,232,.2)" : "var(--border)"}`,
      display: "flex", flexDirection: "column", flexShrink: 0,
      height: "100vh", position: "sticky", top: 0, overflowY: "auto",
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
        {links.map(({ href, icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} style={{
              display:"flex",alignItems:"center",gap:9,padding:"8px 10px",
              borderRadius:8,fontSize:12,
              color: active ? "var(--g2)" : "var(--text3)",
              background: active ? "rgba(34,211,138,.1)" : "transparent",
              textDecoration:"none",marginBottom:2,transition:".15s",
              borderLeft: active ? "3px solid var(--g2)" : "3px solid transparent",
            }}>
              <span style={{fontSize:13,width:17,textAlign:"center"}}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
