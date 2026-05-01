"use client";
import { useState } from "react";
export default function ServicesPage() {
  const [services] = useState([
    { name:"Coiffure & styling", cat:"HAIR", dur:90, price:20000, photos:1, active:true },
  ]);
  return (
    <div style={{padding:"18px 22px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h1 style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700}}>Mes services</h1>
        <div style={{display:"flex",gap:8}}>
          <span style={{fontSize:11,color:"var(--amber)",background:"rgba(245,166,35,.1)",padding:"4px 10px",borderRadius:99}}>1/1 service (plan Free)</span>
          <a href="/plans" style={{padding:"8px 16px",borderRadius:9,background:"var(--g)",color:"#fff",fontSize:12,fontWeight:600,textDecoration:"none"}}>+ Passer à Pro</a>
        </div>
      </div>
      {services.map((s,i) => (
        <div key={i} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:8,background:"rgba(34,211,138,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>💇‍♀️</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,marginBottom:2}}>{s.name}</div>
            <div style={{fontSize:11,color:"var(--text3)"}}>⏱ {s.dur}min · 📸 {s.photos}/1 photo</div>
          </div>
          <div style={{fontFamily:"var(--serif)",fontSize:16,fontWeight:700,color:"var(--g2)"}}>{(s.price/100).toLocaleString("fr")} F</div>
          <button style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:11,cursor:"pointer"}}>Éditer</button>
        </div>
      ))}
      <div style={{background:"rgba(144,96,232,.04)",border:"1px dashed rgba(144,96,232,.2)",borderRadius:12,padding:20,textAlign:"center"}}>
        <div style={{fontSize:20,marginBottom:8}}>🔒</div>
        <div style={{fontWeight:600,marginBottom:4}}>Limite 1 service atteinte</div>
        <div style={{fontSize:12,color:"var(--text3)",marginBottom:12}}>Passez à Pro pour créer jusqu'à 20 services avec 10 photos chacun.</div>
        <a href="/plans" style={{padding:"9px 20px",borderRadius:10,background:"var(--g)",color:"#fff",fontSize:12,fontWeight:700,textDecoration:"none"}}>Passer à Pro — 15 000 F/mois</a>
      </div>
    </div>
  );
}
