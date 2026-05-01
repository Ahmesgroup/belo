"use client";
import { useState, useEffect } from "react";
import { PublicNav } from "@/components/ui/Nav";
import Link from "next/link";

type Tenant = {
  id: string; name: string; slug: string;
  city: string | null; country: string;
  address: string | null; photos: string[];
  plan: string; _count: { bookings: number };
};

const PLAN_BADGE: Record<string, { bg: string; color: string; text: string }> = {
  PREMIUM: { bg:"rgba(144,96,232,.15)", color:"var(--purple)", text:"★ Premium" },
  PRO:     { bg:"rgba(245,166,35,.12)", color:"var(--amber)",  text:"⚡ Pro" },
  FREE:    { bg:"rgba(34,211,138,.08)", color:"var(--g2)",     text:"● Actif" },
};

function SkeletonGrid() {
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
      {Array.from({length:9}).map((_,i) => (
        <div key={i} style={{background:"rgba(255,255,255,.03)",border:"1px solid var(--border)",borderRadius:16,overflow:"hidden"}}>
          <div style={{height:150,background:"rgba(255,255,255,.05)"}} />
          <div style={{padding:14}}>
            <div style={{height:17,width:"65%",background:"rgba(255,255,255,.06)",borderRadius:5,marginBottom:8}} />
            <div style={{height:12,width:"45%",background:"rgba(255,255,255,.04)",borderRadius:4,marginBottom:14}} />
            <div style={{height:34,background:"rgba(255,255,255,.04)",borderRadius:9}} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SalonsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/tenants?page=1&pageSize=20")
      .then(r => r.json())
      .then(d => {
        if (d.data?.tenants) setTenants(d.data.tenants);
        else setError("Impossible de charger les salons.");
      })
      .catch(() => setError("Erreur réseau. Veuillez réessayer."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PublicNav />
      <main style={{paddingTop:56}}>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"32px 5vw 60px"}}>
          <h1 style={{fontFamily:"var(--serif)",fontSize:28,fontWeight:800,marginBottom:8,letterSpacing:"-.02em"}}>
            Tous les salons
          </h1>
          <p style={{color:"var(--text2)",marginBottom:28}}>
            {loading ? "Chargement…" : error ? "" : `${tenants.length} salon${tenants.length !== 1 ? "s" : ""} disponible${tenants.length !== 1 ? "s" : ""} · Réservation en 45 secondes`}
          </p>

          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>
            {["Tous","💇‍♀️ Coiffure","💅 Ongles","💆‍♀️ Massage","✂️ Barbershop","🧖 Spa","💄 Maquillage"].map(c => (
              <button key={c} style={{padding:"6px 14px",borderRadius:99,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:12,cursor:"pointer"}}>
                {c}
              </button>
            ))}
          </div>

          {loading && <SkeletonGrid />}

          {!loading && error && (
            <div style={{textAlign:"center",padding:"60px 0"}}>
              <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
              <div style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:700,marginBottom:8}}>Impossible de charger les salons</div>
              <p style={{color:"var(--text3)",fontSize:13,marginBottom:20}}>{error}</p>
              <button
                onClick={() => { setError(""); setLoading(true); fetch("/api/tenants?page=1&pageSize=20").then(r=>r.json()).then(d=>{if(d.data?.tenants)setTenants(d.data.tenants);else setError("Erreur.");}).catch(()=>setError("Erreur réseau.")).finally(()=>setLoading(false)); }}
                style={{padding:"10px 20px",borderRadius:10,background:"var(--g)",color:"#fff",border:"none",fontFamily:"var(--serif)",fontSize:13,fontWeight:700,cursor:"pointer"}}
              >
                Réessayer
              </button>
            </div>
          )}

          {!loading && !error && tenants.length === 0 && (
            <div style={{textAlign:"center",padding:"60px 0"}}>
              <div style={{fontSize:40,marginBottom:12}}>🔍</div>
              <div style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:700,marginBottom:8}}>Aucun salon trouvé</div>
              <p style={{color:"var(--text3)",fontSize:13}}>Revenez bientôt — de nouveaux salons s'inscrivent chaque semaine.</p>
            </div>
          )}

          {!loading && !error && tenants.length > 0 && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
              {tenants.map(s => {
                const badge = PLAN_BADGE[s.plan] ?? PLAN_BADGE.FREE;
                return (
                  <div key={s.id} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:16,overflow:"hidden",cursor:"pointer",transition:".25s"}}>
                    <div style={{height:150,background:"linear-gradient(135deg,#1a2a1a,#0d2d1a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:48,position:"relative"}}>
                      💇‍♀️
                      {s.plan !== "FREE" && (
                        <span style={{position:"absolute",top:10,right:10,background:badge.bg,color:badge.color,fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99}}>
                          {badge.text}
                        </span>
                      )}
                    </div>
                    <div style={{padding:14}}>
                      <div style={{fontFamily:"var(--serif)",fontSize:15,fontWeight:600,marginBottom:4}}>{s.name}</div>
                      {s.city && <div style={{fontSize:11,color:"var(--text3)",marginBottom:2}}>📍 {s.city}{s.country !== "SN" ? `, ${s.country}` : ""}</div>}
                      <div style={{fontSize:11,color:"var(--text3)",marginBottom:12}}>
                        {s._count.bookings > 0 ? `${s._count.bookings} réservation${s._count.bookings > 1 ? "s" : ""}` : "Nouveau salon"}
                      </div>
                      <Link href={`/booking/${s.slug}`} style={{display:"block",padding:"9px",borderRadius:9,background:"var(--g)",color:"#fff",fontSize:12,fontWeight:600,textAlign:"center",textDecoration:"none"}}>
                        Réserver →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
