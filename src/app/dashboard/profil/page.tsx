"use client";
import { useState } from "react";

export default function DashboardProfilPage() {
  const [name, setName] = useState("Mon Salon");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Dakar");
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div style={{padding:"18px 22px",maxWidth:560}}>
      <h1 style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700,marginBottom:20,color:"var(--text)"}}>
        Mon profil
      </h1>

      <form onSubmit={handleSave} style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:20,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>Informations du salon</div>

          {[
            { label:"Nom du salon", value:name, set:setName, placeholder:"Ex: Studio Aminata Beauty", type:"text" },
            { label:"Téléphone WhatsApp", value:phone, set:setPhone, placeholder:"+221 77 123 45 67", type:"tel" },
            { label:"Adresse", value:address, set:setAddress, placeholder:"Rue 10, Almadies", type:"text" },
            { label:"Ville", value:city, set:setCity, placeholder:"Dakar", type:"text" },
          ].map(f => (
            <div key={f.label}>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"var(--text3)",marginBottom:5}}>{f.label}</label>
              <input
                type={f.type}
                value={f.value}
                onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder}
                style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1px solid var(--border2)",background:"rgba(255,255,255,.04)",fontSize:13,color:"var(--text)",boxSizing:"border-box"}}
              />
            </div>
          ))}
        </div>

        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>Plan actuel</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>🌱 Plan Free</span>
              <div style={{fontSize:11,color:"var(--text3)",marginTop:3}}>20 réservations/mois · 1 service</div>
            </div>
            <a href="/plans" style={{padding:"8px 16px",borderRadius:9,background:"var(--g)",color:"#fff",fontSize:11,fontWeight:700,textDecoration:"none"}}>
              Passer à Pro →
            </a>
          </div>
        </div>

        <button
          type="submit"
          style={{padding:"12px",borderRadius:10,border:"none",background:saved?"rgba(34,211,138,.15)":"var(--g)",color:saved?"var(--g2)":"#fff",fontFamily:"var(--serif)",fontSize:14,fontWeight:700,cursor:"pointer",transition:".2s"}}
        >
          {saved ? "✓ Enregistré" : "Enregistrer les modifications"}
        </button>
      </form>
    </div>
  );
}
