"use client";
import Link from "next/link";
export default function BookingsPage() {
  const bookings = [
    { name:"Aminata Diallo", service:"Coiffure & styling", date:"Auj. 10:00", status:"pending",   price:"20 000", paid:false },
    { name:"Fatou Ndiaye",   service:"Coiffure & styling", date:"Auj. 14:00", status:"pending",   price:"20 000", paid:false },
    { name:"Mariama Sow",    service:"Coiffure & styling", date:"Auj. 16:00", status:"confirmed", price:"20 000", paid:true },
    { name:"Rokhaya Seck",   service:"Coiffure",           date:"Dem. 9:00",  status:"confirmed", price:"20 000", paid:true },
    { name:"Sokhna Diop",    service:"Tresses",            date:"Dem. 14:00", status:"pending",   price:"18 000", paid:false },
  ];
  return (
    <div style={{padding:"18px 22px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h1 style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700}}>Réservations</h1>
        <Link href="/dashboard/horaires" style={{padding:"8px 16px",borderRadius:9,background:"var(--g)",color:"#fff",fontSize:12,fontWeight:600,textDecoration:"none"}}>+ Créer créneau</Link>
      </div>
      <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
        {bookings.map((b,i) => (
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<bookings.length-1?"1px solid rgba(255,255,255,.03)":"none",cursor:"pointer",transition:".15s"}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#503060,#301840)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontFamily:"var(--serif)",fontWeight:800,color:"#fff",flexShrink:0}}>{b.name[0]}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{b.name}</div>
              <div style={{fontSize:11,color:"var(--text3)"}}>{b.service} · {b.date}</div>
              {b.status==="pending" && <span style={{fontSize:9,color:"var(--amber)",background:"rgba(245,166,35,.08)",padding:"1px 5px",borderRadius:4,marginTop:2,display:"inline-block"}}>⚠ À confirmer manuellement</span>}
            </div>
            <div style={{fontSize:12,fontWeight:700,color:"var(--g2)",whiteSpace:"nowrap"}}>{b.price} F</div>
            <span style={{fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:99,background:b.status==="confirmed"?"rgba(34,211,138,.1)":"rgba(245,166,35,.1)",color:b.status==="confirmed"?"var(--g2)":"var(--amber)"}}>{b.status==="confirmed"?"Confirmé":"En attente"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
