"use client";
import { useState } from "react";
import { PublicNav } from "@/components/ui/Nav";
import Link from "next/link";

const PLANS = [
  {
    id:"free", name:"Free", icon:"🌱",
    prices:{ monthly:{fcfa:0,eur:0,usd:0}, annual:{fcfa:0,eur:0,usd:0} },
    tagline:"Pour tester la plateforme.",
    features:[
      {y:true,t:"20 bookings / mois"},
      {y:true,t:"1 service"},
      {y:true,t:"1 photo par service"},
      {y:true,t:"Adresse & contact"},
      {y:false,t:"WhatsApp automatique"},
      {y:false,t:"Acompte client"},
      {y:false,t:"Analytics"},
      {y:false,t:"Réseaux sociaux"},
    ],
    cta:"Commencer gratuitement", ctaStyle:"ghost" as const,
  },
  {
    id:"pro", name:"Pro", icon:"🚀", featured:true,
    prices:{ monthly:{fcfa:15000,eur:23,usd:25}, annual:{fcfa:12500,eur:19,usd:21} },
    tagline:"Pour gérer sérieusement votre salon.",
    features:[
      {y:true,t:"500 bookings / mois"},
      {y:true,t:"20 services"},
      {y:true,t:"10 photos par service"},
      {y:true,t:"WhatsApp auto — -58% no-shows"},
      {y:true,t:"Acompte configurable"},
      {y:true,t:"Analytics basiques"},
      {y:true,t:"Réseaux sociaux"},
      {y:false,t:"Multi-staff"},
    ],
    cta:"Passer à Pro →", ctaStyle:"green" as const,
  },
  {
    id:"premium", name:"Premium", icon:"✦",
    prices:{ monthly:{fcfa:35000,eur:53,usd:58}, annual:{fcfa:29167,eur:44,usd:48} },
    tagline:"Pour dominer votre marché.",
    features:[
      {y:true,t:"Bookings illimités"},
      {y:true,t:"Services illimités"},
      {y:true,t:"50 photos par service"},
      {y:true,t:"WhatsApp + SMS + Email"},
      {y:true,t:"Acompte + remboursement auto"},
      {y:true,t:"Analytics avancés + IA"},
      {y:true,t:"Multi-staff"},
      {y:true,t:"API Webhook"},
    ],
    cta:"Passer Premium →", ctaStyle:"purple" as const,
  },
];

export default function PlansPage() {
  const [period, setPeriod] = useState<"monthly"|"annual">("monthly");
  const [currency, setCurrency] = useState<"fcfa"|"eur"|"usd">("fcfa");

  function price(p: typeof PLANS[0]) {
    const v = p.prices[period][currency];
    if (v === 0) return "Gratuit";
    return currency === "fcfa" ? `${v.toLocaleString("fr")} FCFA` : currency === "eur" ? `${v} €` : `$${v}`;
  }

  return (
    <>
      <PublicNav />
      <main style={{paddingTop:56}}>
        <div style={{maxWidth:1100,margin:"0 auto",padding:"40px 5vw 80px",textAlign:"center"}}>
          <div style={{marginBottom:36}}>
            <h1 style={{fontFamily:"var(--serif)",fontSize:"clamp(28px,5vw,48px)",fontWeight:800,marginBottom:10,letterSpacing:"-.02em"}}>
              Plans & <span style={{color:"var(--g2)"}}>Tarifs</span>
            </h1>
            <p style={{color:"var(--text2)",fontSize:15,maxWidth:480,margin:"0 auto 20px"}}>Commencez gratuitement. Passez au plan supérieur quand votre business est prêt.</p>
            
            {/* Period toggle */}
            <div style={{display:"inline-flex",background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:4,gap:2,marginBottom:12}}>
              {(["monthly","annual"] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{padding:"7px 18px",borderRadius:7,fontSize:12,fontFamily:"var(--sans)",fontWeight:600,cursor:"pointer",border:"none",background:period===p?"var(--g)":"transparent",color:period===p?"#fff":"var(--text3)",transition:".2s"}}>
                  {p === "monthly" ? "Mensuel" : "Annuel — 2 mois offerts"}
                </button>
              ))}
            </div>
            
            {/* Currency */}
            <div style={{display:"flex",gap:6,justifyContent:"center"}}>
              {(["fcfa","eur","usd"] as const).map(c => (
                <button key={c} onClick={() => setCurrency(c)} style={{padding:"4px 12px",borderRadius:99,fontSize:11,border:"1px solid var(--border2)",background:currency===c?"rgba(34,211,138,.08)":"transparent",color:currency===c?"var(--g2)":"var(--text3)",cursor:"pointer",transition:".2s"}}>
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Plan cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:40}}>
            {PLANS.map(p => (
              <div key={p.id} style={{background:"var(--card)",border:`1px solid ${p.id==="pro"?"rgba(59,126,246,.4)":p.id==="premium"?"rgba(144,96,232,.4)":"var(--border)"}`,borderRadius:20,padding:"28px 24px",textAlign:"left",position:"relative",transition:".25s"}}>
                {p.featured && <div style={{position:"absolute",top:-1,left:"50%",transform:"translateX(-50%)",background:"var(--blue)",color:"#fff",fontSize:10,fontWeight:700,padding:"4px 14px",borderRadius:"0 0 10px 10px",letterSpacing:".05em"}}>RECOMMANDÉ</div>}
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"var(--text3)",marginBottom:12}}>{p.icon} {p.name}</div>
                <div style={{marginBottom:8}}>
                  <span style={{fontFamily:"var(--serif)",fontSize:28,fontWeight:800}}>{price(p)}</span>
                  {p.prices.monthly.fcfa > 0 && <span style={{fontSize:13,color:"var(--text3)",marginLeft:4}}>/mois</span>}
                </div>
                <p style={{fontSize:12,color:"var(--text2)",marginBottom:20,lineHeight:1.6}}>{p.tagline}</p>
                <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
                  {p.features.map(f => (
                    <li key={f.t} style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:12}}>
                      <span style={{width:16,height:16,borderRadius:"50%",background:f.y?"rgba(34,211,138,.15)":"rgba(80,96,112,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,flexShrink:0,marginTop:1,color:f.y?"var(--g2)":"var(--text3)"}}>
                        {f.y ? "✓" : "✗"}
                      </span>
                      <span style={{color:f.y?"var(--text2)":"var(--text3)"}}>{f.t}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/login" style={{display:"block",padding:"12px",borderRadius:12,background:p.id==="pro"?"var(--g)":p.id==="premium"?"var(--purple2)":"transparent",border:p.id==="free"?"1px solid var(--border2)":"none",color:p.id==="free"?"var(--text2)":"#fff",textAlign:"center",fontFamily:"var(--serif)",fontWeight:700,fontSize:13,textDecoration:"none",transition:".2s"}}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>

          <p style={{fontSize:12,color:"var(--text3)"}}>Sans engagement · Résiliable à tout moment · Wave · Orange Money · Stripe</p>
        </div>
      </main>
    </>
  );
}
