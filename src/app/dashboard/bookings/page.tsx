"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

type Booking = {
  id: string; status: string; createdAt: string;
  service?: { name: string; priceCents: number };
  slot?:    { startsAt: string };
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:"En attente", CONFIRMED:"Confirmé", COMPLETED:"Terminé", CANCELLED:"Annulé", NO_SHOW:"Absent",
};
const STATUS_COLOR: Record<string, string> = {
  PENDING:"var(--amber)", CONFIRMED:"var(--g2)", COMPLETED:"var(--text3)", CANCELLED:"var(--red)", NO_SHOW:"var(--red)",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday:"short", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    const token = localStorage.getItem("belo_token");
    const user  = (() => { try { return JSON.parse(localStorage.getItem("belo_user") ?? ""); } catch { return null; } })();
    if (!token || !user?.tenantId) { setLoading(false); setError("Non connecté."); return; }

    fetch(`/api/bookings?tenantId=${user.tenantId}&pageSize=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.data?.bookings) setBookings(d.data.bookings);
        else setError(d.error?.message ?? "Erreur de chargement.");
      })
      .catch(() => setError("Erreur réseau."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{padding:"18px 22px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h1 style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700}}>Réservations</h1>
        <Link href="/dashboard/horaires" style={{padding:"8px 16px",borderRadius:9,background:"var(--g)",color:"#fff",fontSize:12,fontWeight:600,textDecoration:"none"}}>+ Créer créneau</Link>
      </div>

      {loading && <div style={{padding:"24px",textAlign:"center",fontSize:13,color:"var(--text3)"}}>Chargement…</div>}
      {error && <div style={{padding:"12px 16px",background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.2)",borderRadius:10,fontSize:13,color:"var(--red)",marginBottom:16}}>{error}</div>}

      {!loading && !error && (
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
          {bookings.length === 0 && (
            <div style={{padding:"40px",textAlign:"center",fontSize:13,color:"var(--text3)"}}>Aucune réservation pour l'instant.</div>
          )}
          {bookings.map((b, i) => (
            <div key={b.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<bookings.length-1?"1px solid rgba(255,255,255,.03)":"none"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#503060,#301840)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontFamily:"var(--serif)",fontWeight:800,color:"#fff",flexShrink:0}}>
                {b.service?.name?.[0] ?? "R"}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{b.service?.name ?? "Réservation"}</div>
                <div style={{fontSize:11,color:"var(--text3)"}}>
                  {b.slot?.startsAt ? fmtDate(b.slot.startsAt) : fmtDate(b.createdAt)}
                </div>
                {b.status === "PENDING" && (
                  <span style={{fontSize:9,color:"var(--amber)",background:"rgba(245,166,35,.08)",padding:"1px 5px",borderRadius:4,marginTop:2,display:"inline-block"}}>⚠ À confirmer</span>
                )}
              </div>
              {b.service?.priceCents != null && (
                <div style={{fontSize:12,fontWeight:700,color:"var(--g2)",whiteSpace:"nowrap"}}>{b.service.priceCents.toLocaleString("fr")} F</div>
              )}
              <span style={{fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:99,background:"rgba(34,211,138,.08)",color:STATUS_COLOR[b.status]??"var(--g2)"}}>
                {STATUS_LABEL[b.status] ?? b.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
