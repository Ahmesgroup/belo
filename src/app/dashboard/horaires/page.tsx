"use client";
import { useState } from "react";

const DAYS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];

const DEFAULT_HOURS = [
  { open:true,  from:"09:00", to:"18:00" },
  { open:true,  from:"09:00", to:"18:00" },
  { open:true,  from:"09:00", to:"18:00" },
  { open:true,  from:"09:00", to:"18:00" },
  { open:true,  from:"09:00", to:"18:00" },
  { open:true,  from:"09:00", to:"16:00" },
  { open:false, from:"10:00", to:"14:00" },
];

export default function HorairesPage() {
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [saved, setSaved] = useState(false);

  function toggle(i: number) {
    setHours(h => h.map((d, idx) => idx === i ? { ...d, open: !d.open } : d));
  }
  function update(i: number, field: "from" | "to", val: string) {
    setHours(h => h.map((d, idx) => idx === i ? { ...d, [field]: val } : d));
  }
  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div style={{padding:"18px 22px",maxWidth:560}}>
      <h1 style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700,marginBottom:6,color:"var(--text)"}}>
        Horaires d'ouverture
      </h1>
      <p style={{fontSize:12,color:"var(--text3)",marginBottom:20}}>
        Configurez vos heures d'ouverture. Les créneaux seront générés automatiquement.
      </p>

      <form onSubmit={handleSave}>
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden",marginBottom:16}}>
          {DAYS.map((day, i) => (
            <div key={day} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<6?"1px solid rgba(255,255,255,.04)":"none"}}>
              <button
                type="button"
                onClick={() => toggle(i)}
                style={{width:36,height:20,borderRadius:10,border:"none",cursor:"pointer",background:hours[i].open?"var(--g)":"rgba(255,255,255,.1)",position:"relative",transition:".2s",flexShrink:0}}
              >
                <span style={{position:"absolute",top:2,left:hours[i].open?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:".2s"}} />
              </button>
              <span style={{width:80,fontSize:13,fontWeight:600,color:hours[i].open?"var(--text)":"var(--text3)",flexShrink:0}}>{day}</span>
              {hours[i].open ? (
                <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                  <input
                    type="time"
                    value={hours[i].from}
                    onChange={e => update(i,"from",e.target.value)}
                    style={{padding:"5px 8px",borderRadius:7,border:"1px solid var(--border2)",background:"rgba(255,255,255,.04)",fontSize:12,color:"var(--text)"}}
                  />
                  <span style={{fontSize:11,color:"var(--text3)"}}>→</span>
                  <input
                    type="time"
                    value={hours[i].to}
                    onChange={e => update(i,"to",e.target.value)}
                    style={{padding:"5px 8px",borderRadius:7,border:"1px solid var(--border2)",background:"rgba(255,255,255,.04)",fontSize:12,color:"var(--text)"}}
                  />
                </div>
              ) : (
                <span style={{fontSize:12,color:"var(--text3)",fontStyle:"italic"}}>Fermé</span>
              )}
            </div>
          ))}
        </div>

        <div style={{background:"rgba(34,211,138,.05)",border:"1px solid rgba(34,211,138,.15)",borderRadius:10,padding:"10px 14px",fontSize:11,color:"var(--text3)",marginBottom:16}}>
          💡 En plan Pro, les créneaux sont générés automatiquement selon ces horaires et envoyés aux clients par WhatsApp.
        </div>

        <button
          type="submit"
          style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:saved?"rgba(34,211,138,.15)":"var(--g)",color:saved?"var(--g2)":"#fff",fontFamily:"var(--serif)",fontSize:14,fontWeight:700,cursor:"pointer",transition:".2s"}}
        >
          {saved ? "✓ Horaires enregistrés" : "Enregistrer les horaires"}
        </button>
      </form>
    </div>
  );
}
