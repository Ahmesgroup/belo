"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

type Booking = {
  id: string; status: string; createdAt: string;
  service?: { name: string; priceCents: number };
  slot?: { startsAt: string };
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:"var(--amber)", CONFIRMED:"var(--g2)", COMPLETED:"var(--text3)", CANCELLED:"var(--red)", NO_SHOW:"var(--red)"
};
const STATUS_LABEL: Record<string, string> = {
  PENDING:"En attente", CONFIRMED:"Confirmé", COMPLETED:"Terminé", CANCELLED:"Annulé", NO_SHOW:"Absent"
};

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [used,     setUsed]     = useState(0);
  const [quota,    setQuota]    = useState(20);
  const [plan,     setPlan]     = useState("FREE");

  useEffect(() => {
    const token = localStorage.getItem("belo_token");
    const user  = (() => { try { return JSON.parse(localStorage.getItem("belo_user") ?? ""); } catch { return null; } })();
    if (!token || !user?.tenantId) { setLoading(false); return; }

    const QUOTAS: Record<string, number> = { FREE: 20, PRO: 500, PREMIUM: Infinity };

    // Fetch tenant for plan + bookingsUsedMonth
    fetch(`/api/tenants/${user.tenantId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.data?.plan)              { setQuota(QUOTAS[d.data.plan] ?? 20); setPlan(d.data.plan); }
        if (d.data?.bookingsUsedMonth) setUsed(d.data.bookingsUsedMonth);
      })
      .catch(() => {});

    // Fetch bookings
    fetch(`/api/bookings?tenantId=${user.tenantId}&pageSize=20`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.data?.bookings) setBookings(d.data.bookings);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const todayBookings  = bookings.filter(b => b.slot?.startsAt && new Date(b.slot.startsAt).toDateString() === new Date().toDateString());
  const todayRevenue   = todayBookings.reduce((s, b) => s + (b.service?.priceCents ?? 0), 0);
  const remaining      = Math.max(0, quota - used);
  const quotaPct       = Math.min(100, (used / quota) * 100);

  return (
    <div style={{padding:"18px 22px"}}>
      <h1 style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700,marginBottom:16,color:"var(--text)"}}>
        Dashboard Gérant
      </h1>

      {/* Quota alert */}
      <div style={{background:"rgba(245,166,35,.07)",border:"1px solid rgba(245,166,35,.22)",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--amber)",marginBottom:4}}>
          ⚠️ {remaining} booking{remaining !== 1 ? "s" : ""} restant{remaining !== 1 ? "s" : ""} ce mois
        </div>
        <div style={{height:5,background:"rgba(255,255,255,.08)",borderRadius:99,overflow:"hidden",marginBottom:6}}>
          <div style={{height:"100%",width:`${quotaPct}%`,background:"var(--amber)",borderRadius:99,transition:".4s"}} />
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--amber)"}}>
          <span>{used} utilisés</span>
          {plan === "FREE" && <Link href="/plans" style={{color:"var(--g2)",textDecoration:"none",fontWeight:700}}>Passer à Pro →</Link>}
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:14}}>
          <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",marginBottom:7}}>Bookings du jour</div>
          <div style={{fontFamily:"var(--serif)",fontSize:22,fontWeight:800,color:"var(--g2)"}}>{loading ? "…" : todayBookings.length}</div>
        </div>
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:14}}>
          <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",marginBottom:7}}>Revenue estimé</div>
          <div style={{fontFamily:"var(--serif)",fontSize:22,fontWeight:800,color:"var(--amber)"}}>
            {loading ? "…" : todayRevenue > 0 ? `${Math.round(todayRevenue/1000)}k F` : "0 F"}
          </div>
        </div>
      </div>

      {/* Bookings list */}
      <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden",marginBottom:16}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontFamily:"var(--serif)",fontWeight:700,fontSize:13}}>Réservations récentes</span>
          <Link href="/dashboard/bookings" style={{fontSize:11,color:"var(--g2)",textDecoration:"none"}}>Voir tout</Link>
        </div>
        {loading && <div style={{padding:"20px",textAlign:"center",fontSize:12,color:"var(--text3)"}}>Chargement…</div>}
        {!loading && bookings.length === 0 && (
          <div style={{padding:"24px",textAlign:"center",fontSize:12,color:"var(--text3)"}}>
            Aucune réservation pour l'instant.
          </div>
        )}
        {bookings.slice(0,5).map((b,i) => (
          <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:i<Math.min(bookings.length,5)-1?"1px solid rgba(255,255,255,.03)":"none"}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#503060,#301840)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontFamily:"var(--serif)",fontWeight:800,color:"#fff",flexShrink:0}}>
              {(b.service?.name?.[0] ?? "R")}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600,marginBottom:1}}>{b.service?.name ?? "Réservation"}</div>
              {b.slot?.startsAt && <div style={{fontSize:10,color:"var(--text3)"}}>{new Date(b.slot.startsAt).toLocaleDateString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>}
            </div>
            {b.service?.priceCents && <div style={{fontSize:11,fontWeight:700,color:"var(--g2)"}}>{b.service.priceCents.toLocaleString("fr")} F</div>}
            <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:99,background:"rgba(34,211,138,.1)",color:STATUS_COLOR[b.status]??"var(--g2)"}}>{STATUS_LABEL[b.status]??b.status}</span>
          </div>
        ))}
      </div>

      {plan === "FREE" && (
        <div style={{textAlign:"center"}}>
          <Link href="/plans" style={{padding:"10px 20px",borderRadius:10,background:"var(--g)",color:"#fff",fontFamily:"var(--serif)",fontSize:13,fontWeight:700,textDecoration:"none"}}>
            🚀 Passer à Pro
          </Link>
        </div>
      )}
    </div>
  );
}
