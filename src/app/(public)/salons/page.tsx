import { PublicNav } from "@/components/ui/Nav";
import Link from "next/link";

const SALONS = [
  { name:"Salon Aminata Beauty", loc:"Almadies, Dakar",  cat:"Coiffure", icon:"💇‍♀️", r:"4.9", rv:128, price:"5 000",  plan:"active",  slug:"salon-aminata-beauty" },
  { name:"Nails & Co Dakar",     loc:"Plateau, Dakar",   cat:"Ongles",   icon:"💅",    r:"4.8", rv:94,  price:"8 000",  plan:"premium", slug:"nails-co-dakar" },
  { name:"Zen Spa Thiès",        loc:"Centre, Thiès",    cat:"Massage",  icon:"💆‍♀️",  r:"4.7", rv:63,  price:"12 000", plan:"pro",     slug:"zen-spa-thies" },
  { name:"Beauté Fatou Diallo",  loc:"HLM, Dakar",       cat:"Beauté",   icon:"🧖‍♀️",  r:"4.6", rv:41,  price:"3 500",  plan:"active",  slug:"beaute-fatou-diallo" },
  { name:"King Barber Dakar",    loc:"Sicap, Dakar",     cat:"Barbershop",icon:"✂️",   r:"4.7", rv:89,  price:"4 000",  plan:"pro",     slug:"king-barber-dakar" },
  { name:"Studio Élégance",      loc:"Plateau, Dakar",   cat:"Ongles",   icon:"💅",    r:"4.9", rv:214, price:"9 000",  plan:"premium", slug:"studio-elegance-dakar" },
];

export default function SalonsPage() {
  return (
    <>
      <PublicNav />
      <main style={{paddingTop:56}}>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"32px 5vw 60px"}}>
          <h1 style={{fontFamily:"var(--serif)",fontSize:28,fontWeight:800,marginBottom:8,letterSpacing:"-.02em"}}>Tous les salons</h1>
          <p style={{color:"var(--text2)",marginBottom:28}}>340 salons disponibles · Réservation en 45 secondes</p>

          {/* Filters */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>
            {["Tous","💇‍♀️ Coiffure","💅 Ongles","💆‍♀️ Massage","✂️ Barbershop","🧖 Spa","💄 Maquillage"].map(c => (
              <button key={c} style={{padding:"6px 14px",borderRadius:99,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:12,fontFamily:"var(--sans)",cursor:"pointer"}}>{c}</button>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
            {SALONS.map(s => (
              <div key={s.slug} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:16,overflow:"hidden",cursor:"pointer",transition:".25s"}}>
                <div style={{height:150,background:"linear-gradient(135deg,#1a2a1a,#0d2d1a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:48,position:"relative"}}>
                  {s.icon}
                  {s.plan === "premium" && <span style={{position:"absolute",top:10,right:10,background:"rgba(144,96,232,.15)",color:"var(--purple)",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99}}>★ Premium</span>}
                  {s.plan === "pro" && <span style={{position:"absolute",top:10,right:10,background:"rgba(245,166,35,.12)",color:"var(--amber)",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99}}>⚡ PRO</span>}
                </div>
                <div style={{padding:14}}>
                  <div style={{fontFamily:"var(--serif)",fontSize:15,fontWeight:600,marginBottom:4}}>{s.name}</div>
                  <div style={{fontSize:11,color:"var(--text3)",marginBottom:2}}>📍 {s.loc}</div>
                  <div style={{fontSize:11,color:"var(--text3)",marginBottom:12}}>🏷 {s.cat}</div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                    <span style={{fontSize:12,color:"var(--amber)",fontWeight:600}}>★ {s.r} <span style={{color:"var(--text3)",fontWeight:400}}>({s.rv})</span></span>
                    <span style={{fontSize:12,color:"var(--text3)"}}>dès {s.price} FCFA</span>
                  </div>
                  <Link href={`/booking/${s.slug}`} style={{display:"block",padding:"9px",borderRadius:9,background:"var(--g)",color:"#fff",fontSize:12,fontWeight:600,textAlign:"center",textDecoration:"none"}}>Réserver →</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
