"use client";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div style={{padding:"18px 22px"}}>
      <h1 style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700,marginBottom:16,color:"var(--text)"}}>
        Dashboard Gérant
      </h1>
      <div style={{background:"rgba(245,166,35,.07)",border:"1px solid rgba(245,166,35,.22)",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--amber)"}}>⚠️ Il vous reste 4 bookings ce mois</div>
        <div style={{fontSize:11,color:"var(--text2)",marginTop:4}}>Plan Free limité à 20 réservations/mois.</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:14}}>
          <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",marginBottom:7}}>Bookings du jour</div>
          <div style={{fontFamily:"var(--serif)",fontSize:22,fontWeight:800,color:"var(--g2)"}}>3</div>
        </div>
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:14}}>
          <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",marginBottom:7}}>Revenue estimé</div>
          <div style={{fontFamily:"var(--serif)",fontSize:22,fontWeight:800,color:"var(--amber)"}}>15k F</div>
        </div>
      </div>
      <div style={{marginTop:16,textAlign:"center"}}>
        <Link href="/plans" style={{padding:"10px 20px",borderRadius:10,background:"var(--g)",color:"#fff",fontFamily:"var(--serif)",fontSize:13,fontWeight:700,textDecoration:"none"}}>
          🚀 Passer à Pro
        </Link>
      </div>
    </div>
  );
}
