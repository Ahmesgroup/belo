"use client";
import { PublicNav } from "@/components/ui/Nav";
import { useState } from "react";
export default function ProfilPage() {
  const [tab, setTab] = useState(0);
  const tabs = ["Profil","Salons","Historique","Réglages"];
  return (
    <>
      <PublicNav />
      <main style={{paddingTop:56}}>
        <div style={{maxWidth:430,margin:"0 auto",padding:"24px 16px 60px"}}>
          {/* Avatar */}
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,var(--g2),var(--blue)",padding:3,margin:"0 auto 10px",cursor:"pointer"}}>
              <div style={{width:"100%",height:"100%",borderRadius:"50%",background:"linear-gradient(135deg,#503060,#301840)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--serif)",fontSize:28,fontWeight:800,color:"#fff"}}>A</div>
            </div>
            <div style={{fontFamily:"var(--serif)",fontWeight:800,fontSize:20,marginBottom:2}}>Aminata Diallo</div>
            <div style={{fontSize:11,color:"var(--text3)"}}>Membre depuis janvier 2025 · Dakar</div>
          </div>
          {/* Stats */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",background:"var(--border)",gap:1,borderTop:"1px solid var(--border)",marginBottom:20}}>
            {[["24","Réservations"],["186k","FCFA"],["4.9★","Note"]].map(([n,l]) => (
              <div key={l} style={{background:"var(--card2)",padding:"14px 10px",textAlign:"center"}}>
                <div style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:800,color:"var(--g2)"}}>{n}</div>
                <div style={{fontSize:9,color:"var(--text3)",marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
          {/* Tabs */}
          <div style={{display:"flex",gap:0,background:"var(--bg2)",borderRadius:10,padding:3,marginBottom:16}}>
            {tabs.map((t,i) => (
              <button key={t} onClick={() => setTab(i)} style={{flex:1,padding:8,borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",border:"none",background:tab===i?"var(--card)":"transparent",color:tab===i?"var(--text)":"var(--text3)",transition:".2s"}}>
                {t}
              </button>
            ))}
          </div>
          {/* Profile tab */}
          {tab === 0 && (
            <div>
              <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:16,marginBottom:14}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                  <div><label style={{display:"block",fontSize:9,fontWeight:700,color:"var(--text3)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>Prénom</label><input defaultValue="Aminata" /></div>
                  <div><label style={{display:"block",fontSize:9,fontWeight:700,color:"var(--text3)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>Nom</label><input defaultValue="Diallo" /></div>
                </div>
                <div style={{marginBottom:12}}><label style={{display:"block",fontSize:9,fontWeight:700,color:"var(--text3)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>WhatsApp</label>
                  <div style={{display:"flex",border:"1px solid var(--border2)",borderRadius:9,overflow:"hidden"}}>
                    <div style={{padding:"9px 10px",background:"rgba(255,255,255,.04)",borderRight:"1px solid var(--border2)",fontSize:12,color:"var(--text3)"}}>🇸🇳 +221</div>
                    <input type="tel" defaultValue="77 234 56 78" style={{flex:1,border:"none",borderRadius:0}} />
                  </div>
                </div>
                <div style={{marginBottom:12}}><label style={{display:"block",fontSize:9,fontWeight:700,color:"var(--text3)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>Email</label><input type="email" defaultValue="aminata.diallo@gmail.com" /></div>
                <button style={{width:"100%",padding:12,borderRadius:12,border:"none",background:"var(--g)",color:"#fff",fontFamily:"var(--serif)",fontWeight:700,fontSize:14,cursor:"pointer"}}>✓ Enregistrer</button>
              </div>
            </div>
          )}
          {tab === 3 && (
            <div>
              <button style={{width:"100%",padding:12,borderRadius:9,border:"1px solid var(--border2)",background:"transparent",color:"var(--text2)",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:12}}>
                🚪 Se déconnecter
              </button>
              <div style={{background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.2)",borderRadius:12,padding:14}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--red)",marginBottom:10}}>Zone sensible</div>
                <button style={{width:"100%",padding:9,borderRadius:8,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",color:"var(--red)",fontSize:12,cursor:"pointer"}}>🗑 Supprimer mon compte</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
