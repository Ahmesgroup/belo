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

const FILTERS = ["Tous","💇‍♀️ Coiffure","💅 Ongles","💆‍♀️ Massage","✂️ Barbershop","🧖 Spa","💄 Maquillage"];

// Maps filter label → DB category value
const CAT_MAP: Record<string, string> = {
  "💇‍♀️ Coiffure":  "hair",
  "💅 Ongles":      "nails",
  "💆‍♀️ Massage":   "massage",
  "✂️ Barbershop":  "barber",
  "🧖 Spa":         "spa",
  "💄 Maquillage":  "beauty",
};

// Resolve a raw ?cat= URL param to one of our FILTERS labels
function resolveInitialCat(raw: string | null): string {
  if (!raw) return "Tous";
  if (FILTERS.includes(raw)) return raw;
  const lower = raw.toLowerCase();
  return FILTERS.find(f => f.toLowerCase().includes(lower) || lower.includes(f.replace(/[^\w]/g, "").toLowerCase())) ?? "Tous";
}

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
  const [category, setCategory] = useState("Tous");
  const [tenants,  setTenants]  = useState<Tenant[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  // Read ?cat= from URL on mount and apply as initial filter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const initial = resolveInitialCat(params.get("cat"));
      if (initial !== "Tous") setCategory(initial);
    }
  }, []);

  // Re-fetch whenever category changes
  useEffect(() => {
    setLoading(true);
    setError("");
    const catParam = category !== "Tous" && CAT_MAP[category]
      ? `&category=${encodeURIComponent(CAT_MAP[category])}`
      : "";
    fetch(`/api/tenants?page=1&pageSize=20${catParam}`)
      .then(r => r.json())
      .then(d => {
        if (d.data?.tenants) {
          setTenants(d.data.tenants);
          if (d.data.pagination?.total) setTotal(d.data.pagination.total);
        } else setError("Impossible de charger les salons.");
      })
      .catch(() => setError("Erreur réseau. Veuillez réessayer."))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <>
      <PublicNav />
      <main style={{paddingTop:56}}>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"32px 5vw 60px"}}>
          <h1 style={{fontFamily:"var(--serif)",fontSize:28,fontWeight:800,marginBottom:8,letterSpacing:"-.02em"}}>
            Tous les salons
          </h1>
          <p style={{color:"var(--text2)",marginBottom:28}}>
            {loading
              ? "Chargement…"
              : error
              ? ""
              : `${total > 0 ? total : tenants.length} salon${(total || tenants.length) !== 1 ? "s" : ""} disponible${(total || tenants.length) !== 1 ? "s" : ""} · Réservation en 45 secondes`}
          </p>

          {/* Category filters */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setCategory(f)}
                style={{padding:"6px 14px",borderRadius:99,border:`1px solid ${category===f?"var(--g2)":"var(--border2)"}`,background:category===f?"rgba(34,211,138,.1)":"transparent",color:category===f?"var(--g2)":"var(--text3)",fontSize:12,cursor:"pointer",transition:".2s",fontWeight:category===f?600:400}}
              >
                {f}
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
                onClick={() => setCategory(c => c)}
                style={{padding:"10px 20px",borderRadius:10,background:"var(--g)",color:"#fff",border:"none",fontFamily:"var(--serif)",fontSize:13,fontWeight:700,cursor:"pointer"}}
              >
                Réessayer
              </button>
            </div>
          )}

          {!loading && !error && tenants.length === 0 && (
            <div style={{textAlign:"center",padding:"60px 0"}}>
              <div style={{fontSize:40,marginBottom:12}}>🔍</div>
              <div style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:700,marginBottom:8}}>
                {category === "Tous" ? "Aucun salon trouvé" : `Aucun salon "${category.replace(/^\S+\s/,"")}" trouvé`}
              </div>
              <p style={{color:"var(--text3)",fontSize:13,marginBottom:16}}>
                Revenez bientôt — de nouveaux salons s'inscrivent chaque semaine.
              </p>
              {category !== "Tous" && (
                <button onClick={() => setCategory("Tous")} style={{padding:"8px 16px",borderRadius:9,border:"1px solid var(--border2)",background:"transparent",color:"var(--text2)",fontSize:12,cursor:"pointer"}}>
                  Voir tous les salons
                </button>
              )}
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
