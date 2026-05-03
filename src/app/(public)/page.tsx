"use client";
import { useState, useEffect } from "react";
import { useLang } from "@/hooks/useLang";
import { useRouter } from "next/navigation";
import { PublicNav } from "@/components/ui/Nav";
import Link from "next/link";

type Tenant = { id: string; name: string; slug: string; city: string | null; plan: string; coverUrl?: string | null; _count: { bookings: number } };

const planBadge = (p: string) =>
  p === "PREMIUM" ? { bg:"rgba(144,96,232,.12)", color:"var(--purple)", text:"★ Premium" } :
  p === "PRO"     ? { bg:"rgba(245,166,35,.12)",  color:"var(--amber)",  text:"⚡ PRO" } :
                    { bg:"rgba(34,211,138,.12)",   color:"var(--g2)",    text:"● Disponible" };

export default function LandingPage() {
  const { t } = useLang();
  const router = useRouter();
  const [salons,      setSalons]      = useState<Tenant[]>([]);
  const [salonTotal,  setSalonTotal]  = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCity,  setSearchCity]  = useState("");

  useEffect(() => {
    fetch("/api/tenants?pageSize=4")
      .then(r => r.json())
      .then(d => {
        if (d.data?.tenants) setSalons(d.data.tenants);
        if (d.data?.pagination?.total) setSalonTotal(d.data.pagination.total);
      })
      .catch(() => {});
  }, []);

  function handleSearch() {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (searchCity.trim())  params.set("city",   searchCity.trim());
    router.push(`/salons${params.toString() ? "?" + params.toString() : ""}`);
  }

  return (
    <>
      <PublicNav />
      <main style={{paddingTop:56}}>

        {/* HERO */}
        <section style={{minHeight:"auto",padding:"80px 5vw 60px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:"15%",left:"50%",transform:"translateX(-50%)",width:600,height:400,background:"radial-gradient(ellipse at center,rgba(34,211,138,.07) 0%,transparent 70%)",pointerEvents:"none"}} />
          <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px)",backgroundSize:"60px 60px",maskImage:"radial-gradient(ellipse at center,black 0%,transparent 70%)"}} />

          <div style={{position:"relative",zIndex:1,maxWidth:720,width:"100%"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(34,211,138,.08)",border:"1px solid rgba(34,211,138,.18)",color:"var(--g2)",fontSize:11,fontWeight:600,padding:"5px 14px",borderRadius:99,marginBottom:24,letterSpacing:".06em"}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:"var(--g2)",animation:"pulse 2s infinite"}} />
              ✦ Disponible à Dakar, Thiès, Saint-Louis
            </div>

            <h1 style={{fontFamily:"var(--serif)",fontSize:"clamp(36px,5.5vw,68px)",fontWeight:800,lineHeight:1.08,letterSpacing:"-.03em",marginBottom:20}}>
              {t("hero_title")}<br /><span style={{color:"var(--g2)",fontStyle:"italic"}}>{t("hero_title2")}</span><br /><span style={{color:"var(--text2)"}}>{t("hero_sub")}</span>
            </h1>

            <p style={{fontSize:16,color:"var(--text2)",lineHeight:1.7,maxWidth:520,margin:"0 auto 32px"}}>
              {t("hero_desc")}
            </p>

            <div style={{background:"var(--card)",border:"1px solid var(--border2)",borderRadius:14,padding:5,display:"flex",flexWrap:"wrap",gap:0,maxWidth:600,width:"100%",margin:"0 auto 16px"}}>
              <div style={{flex:1,minWidth:130,display:"flex",alignItems:"center",gap:8,padding:"9px 13px"}}>
                <span style={{fontSize:13,color:"var(--text3)"}}>🔍</span>
                <input placeholder={t("search_service")} value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSearch()} style={{flex:1,background:"transparent",border:"none",outline:"none",fontFamily:"var(--sans)",fontSize:13,color:"var(--text)"}} />
              </div>
              <div style={{width:1,background:"var(--border)",margin:"5px 0"}} />
              <div style={{flex:1,minWidth:130,display:"flex",alignItems:"center",gap:8,padding:"9px 13px"}}>
                <span style={{fontSize:13,color:"var(--text3)"}}>📍</span>
                <input placeholder={t("search_city")} value={searchCity} onChange={e=>setSearchCity(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSearch()} style={{flex:1,background:"transparent",border:"none",outline:"none",fontFamily:"var(--sans)",fontSize:13,color:"var(--text)"}} />
              </div>
              <button onClick={handleSearch} style={{background:"var(--g)",color:"#fff",border:"none",padding:"10px 20px",borderRadius:10,fontFamily:"var(--sans)",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                {t("search_btn")}
              </button>
            </div>

            <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",marginBottom:28}}>
              {[
                {label:"✦ Tous",          cat:""},
                {label:"💇‍♀️ Coiffure",  cat:"💇‍♀️ Coiffure"},
                {label:"💅 Manucure",     cat:"💅 Ongles"},
                {label:"💆‍♀️ Massage",   cat:"💆‍♀️ Massage"},
                {label:"🧖 Soins",        cat:"🧖 Spa"},
                {label:"💄 Maquillage",   cat:"💄 Maquillage"},
              ].map(({label, cat}) => (
                <Link key={label} href={cat ? `/salons?cat=${encodeURIComponent(cat)}` : "/salons"} style={{padding:"5px 13px",borderRadius:99,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:11,textDecoration:"none"}}>{label}</Link>
              ))}
            </div>

            <div style={{display:"flex",flexWrap:"wrap",border:"1px solid var(--border)",borderRadius:14,overflow:"hidden",maxWidth:600,width:"100%",margin:"0 auto",background:"rgba(11,15,22,.8)",backdropFilter:"blur(8px)"}}>
              {[
                [salonTotal > 0 ? `${Math.round(salonTotal*50)}+` : "250+", "Réservations"],
                [salonTotal > 0 ? `${salonTotal}+` : "5+",                  "Salons partenaires"],
                ["4.8★",                                                      "Note moyenne"],
                ["Wave ✓",                                                    "+ Orange Money"],
              ].map(([n,l],idx) => (
                <div key={l} style={{flex:1,minWidth:"120px",padding:"16px 18px",textAlign:"center",borderRight:idx<3?"1px solid var(--border)":"none"}}>
                  <div style={{fontFamily:"var(--serif)",fontSize:22,fontWeight:700,color:"var(--g2)",lineHeight:1,marginBottom:3}}>{n}</div>
                  <div style={{fontSize:10,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em"}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SALONS EN VEDETTE */}
        <section style={{padding:"48px 5vw",maxWidth:1200,margin:"0 auto"}} id="salons">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
            <h2 style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700}}>{t("featured_salons")}</h2>
            <Link href="/salons" style={{padding:"7px 14px",borderRadius:9,fontSize:12,fontWeight:600,border:"1px solid var(--border2)",color:"var(--text2)",textDecoration:"none"}}>{t("see_all")}</Link>
          </div>
          {salons.length === 0 ? (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16}}>
              {Array.from({length:4}).map((_,i) => (
                <div key={i} style={{background:"rgba(255,255,255,.03)",border:"1px solid var(--border)",borderRadius:16,overflow:"hidden"}}>
                  <div style={{height:140,background:"rgba(255,255,255,.05)"}} />
                  <div style={{padding:14}}>
                    <div style={{height:16,width:"60%",background:"rgba(255,255,255,.06)",borderRadius:5,marginBottom:10}} />
                    <div style={{height:32,background:"rgba(255,255,255,.04)",borderRadius:9}} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16}}>
              {salons.map(s => {
                const b = planBadge(s.plan);
                return (
                  <div key={s.id} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:16,overflow:"hidden",cursor:"pointer",transition:".25s"}} className="salon-hover">
                    <div style={{height:140,background:"linear-gradient(135deg,#1a2a1a,#0d2d1a)",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,overflow:"hidden"}}>
                      {s.coverUrl ? (
                        <img src={s.coverUrl} alt={s.name} style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}} />
                      ) : (
                        <span style={{position:"relative",zIndex:1}}>💇‍♀️</span>
                      )}
                      <div style={{position:"absolute",top:10,right:10,background:b.bg,color:b.color,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:99,border:`1px solid ${b.color}33`,zIndex:2}}>{b.text}</div>
                    </div>
                    <div style={{padding:14}}>
                      <div style={{fontFamily:"var(--serif)",fontSize:14,fontWeight:600,marginBottom:4}}>{s.name}</div>
                      {s.city && <div style={{fontSize:11,color:"var(--text3)",marginBottom:10}}>📍 {s.city}</div>}
                      <Link href={`/booking/${s.slug}`} style={{display:"block",width:"100%",padding:"8px",borderRadius:9,background:"var(--g)",color:"#fff",fontSize:12,fontWeight:600,textAlign:"center",textDecoration:"none",transition:".2s"}}>
                        Réserver →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* HOW IT WORKS */}
        <section id="how" style={{padding:"60px 5vw",background:"rgba(11,15,22,.4)",borderTop:"1px solid var(--border)"}}>
          <div style={{maxWidth:1000,margin:"0 auto",textAlign:"center"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(34,211,138,.08)",border:"1px solid rgba(34,211,138,.18)",color:"var(--g2)",fontSize:11,fontWeight:600,padding:"4px 12px",borderRadius:99,marginBottom:16,letterSpacing:".06em"}}>Comment ça marche</div>
            <h2 style={{fontFamily:"var(--serif)",fontSize:"clamp(24px,4vw,40px)",fontWeight:800,marginBottom:12,letterSpacing:"-.02em"}}>{t("how_title")}</h2>
            <p style={{color:"var(--text2)",fontSize:15,marginBottom:40}}>{t("how_sub")}</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:20}}>
              {[
                { n:"1", icon:"🔍", title:t("step1_title"), sub:t("step1_desc"), time:t("step1_time") },
                { n:"2", icon:"🕐", title:t("step2_title"), sub:t("step2_desc"), time:t("step2_time") },
                { n:"3", icon:"💳", title:t("step3_title"), sub:t("step3_desc"), time:t("step3_time") },
                { n:"4", icon:"✅", title:t("step4_title"), sub:t("step4_desc"), time:t("step4_time") },
              ].map(s => (
                <div key={s.n} style={{textAlign:"center",padding:"0 16px"}}>
                  <div style={{width:56,height:56,borderRadius:"50%",background:"var(--card)",border:"1px solid var(--border2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 16px"}}>{s.icon}</div>
                  <div style={{fontFamily:"var(--serif)",fontWeight:600,fontSize:14,marginBottom:8}}>{s.title}</div>
                  <div style={{fontSize:12,color:"var(--text3)",lineHeight:1.5,marginBottom:10}}>{s.sub}</div>
                  <span style={{display:"inline-block",fontSize:10,fontWeight:600,color:"var(--g2)",background:"rgba(34,211,138,.08)",border:"1px solid rgba(34,211,138,.15)",padding:"3px 10px",borderRadius:99}}>{s.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{padding:"60px 5vw",textAlign:"center"}}>
          <div style={{maxWidth:600,margin:"0 auto",background:"var(--card)",border:"1px solid var(--border2)",borderRadius:24,padding:"48px 32px"}}>
            <h2 style={{fontFamily:"var(--serif)",fontSize:"clamp(24px,4vw,40px)",fontWeight:800,marginBottom:12,letterSpacing:"-.02em"}}>Votre prochain rendez-vous <span style={{color:"var(--g2)",fontStyle:"italic"}}>vous attend là</span></h2>
            <p style={{color:"var(--text2)",marginBottom:28}}>{salonTotal > 0 ? salonTotal : "…"} salons disponibles. Réservation en 45 secondes. Confirmation immédiate.</p>
            <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
              <Link href="/salons" style={{padding:"13px 26px",borderRadius:12,background:"var(--g)",color:"#fff",fontFamily:"var(--serif)",fontSize:14,fontWeight:700,textDecoration:"none"}}>{t("cta_find")}</Link>
              <Link href="/plans" style={{padding:"13px 26px",borderRadius:12,background:"rgba(255,255,255,.06)",color:"var(--text)",border:"1px solid var(--border2)",fontFamily:"var(--sans)",fontSize:14,textDecoration:"none"}}>{t("cta_salons")}</Link>
            </div>
            <p style={{marginTop:20,fontSize:11,color:"var(--text3)"}}>Gratuit · Annulation sans frais · Paiement sécurisé</p>
          </div>
        </section>

        <footer style={{padding:"32px 5vw",borderTop:"1px solid var(--border)",textAlign:"center"}}>
          <div style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:700,marginBottom:6}}>belo<span style={{color:"var(--g2)"}}>.</span></div>
          <div style={{display:"flex",gap:20,justifyContent:"center",flexWrap:"wrap",marginBottom:12}}>
            {[
              {label:"À propos",         href:"/"},
              {label:"Salons",           href:"/salons"},
              {label:"Pour les gérants", href:"/pour-les-salons"},
              {label:"Plans",            href:"/plans"},
              {label:"Confidentialité",  href:"/confidentialite"},
              {label:"Contact",          href:"mailto:contact@belo.sn"},
            ].map(({label,href}) => (
              <Link key={label} href={href} style={{fontSize:12,color:"var(--text3)",textDecoration:"none"}}>{label}</Link>
            ))}
          </div>
          <p style={{fontSize:11,color:"var(--text3)"}}>© 2026 Belo · Dakar, Sénégal — La beauté réservée en 45 secondes</p>
        </footer>

      </main>
      <style>{`.salon-hover:hover{border-color:rgba(34,211,138,.3)!important;transform:translateY(-3px)}`}</style>
    </>
  );
}
