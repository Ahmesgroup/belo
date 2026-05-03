"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getUser, authHeaders, jsonAuthHeaders } from "@/lib/auth-client";

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

type Toast = { id: number; msg: string; ok: boolean };

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [toasts,   setToasts]   = useState<Toast[]>([]);

  function addToast(msg: string, ok = true) {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, ok }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }

  const loadBookings = useCallback(() => {
    const user = getUser();
    if (!user?.tenantId) { setLoading(false); return; }
    fetch(`/api/bookings?tenantId=${user.tenantId}&pageSize=50`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.data?.bookings) setBookings(d.data.bookings);
        else setError(d.error?.message ?? "Erreur de chargement.");
      })
      .catch(() => setError("Erreur réseau."))
      .finally(() => setLoading(false));
  }, []);

  // Initial load
  useEffect(() => { loadBookings(); }, [loadBookings]);

  // Re-fetch whenever the dashboard layout signals that tenant data changed
  // (e.g. after a booking is accepted/refused from another tab or the layout badge updates)
  useEffect(() => {
    window.addEventListener("tenant-updated", loadBookings);
    return () => window.removeEventListener("tenant-updated", loadBookings);
  }, [loadBookings]);

  async function updateStatus(bookingId: string, status: "CONFIRMED" | "CANCELLED") {
    setUpdating(bookingId);
    try {
      const res = await fetch("/api/bookings", {
        method:  "PATCH",
        headers: jsonAuthHeaders(),
        body:    JSON.stringify({ bookingId, status }),
      });
      const d = await res.json();
      if (res.ok) {
        // Optimistic update — instant UI feedback
        setBookings(prev => prev.map(b =>
          b.id === bookingId ? { ...b, status: d.data.booking.status } : b
        ));
        addToast(status === "CONFIRMED" ? "✅ Réservation acceptée" : "❌ Réservation refusée", status === "CONFIRMED");
        // Notify the layout to refresh its pending-count badge
        window.dispatchEvent(new Event("tenant-updated"));
        // Full server sync to ensure consistent state after the mutation
        loadBookings();
      } else {
        addToast(d.error?.message ?? "Erreur", false);
      }
    } catch {
      addToast("Erreur réseau", false);
    } finally {
      setUpdating(null);
    }
  }

  const pendingCount = bookings.filter(b => b.status === "PENDING").length;

  return (
    <div style={{padding:"18px 22px"}}>
      {/* Toast stack */}
      <div style={{position:"fixed",bottom:20,right:20,zIndex:1000,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
        {toasts.map(t => (
          <div key={t.id} style={{background:"var(--card)",border:`1px solid ${t.ok?"rgba(34,211,138,.3)":"rgba(239,68,68,.3)"}`,borderRadius:12,padding:"10px 16px",fontSize:13,minWidth:220,boxShadow:"0 8px 24px rgba(0,0,0,.4)",pointerEvents:"all",color:"var(--text)"}}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <h1 style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700}}>Réservations</h1>
          {pendingCount > 0 && (
            <span style={{background:"var(--amber)",color:"#111",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99}}>
              {pendingCount} en attente
            </span>
          )}
        </div>
        <Link href="/dashboard/horaires" style={{padding:"8px 16px",borderRadius:9,background:"var(--g)",color:"#fff",fontSize:12,fontWeight:600,textDecoration:"none"}}>+ Créer créneau</Link>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{padding:"40px",textAlign:"center"}}>
          <div style={{width:28,height:28,border:"3px solid var(--border2)",borderTopColor:"var(--g2)",borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 10px"}} />
          <div style={{fontSize:13,color:"var(--text3)"}}>Chargement…</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{padding:"12px 16px",background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.2)",borderRadius:10,fontSize:13,color:"var(--red)",marginBottom:16}}>
          {error}
          <button type="button" onClick={loadBookings} style={{marginLeft:12,color:"var(--g2)",background:"none",border:"none",cursor:"pointer",fontSize:12,textDecoration:"underline"}}>
            Réessayer
          </button>
        </div>
      )}

      {/* Booking list */}
      {!loading && !error && (
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
          {bookings.length === 0 ? (
            <div style={{padding:"48px",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:12}}>📅</div>
              <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>Aucune réservation</div>
              <div style={{fontSize:12,color:"var(--text3)",marginBottom:20}}>Les réservations de vos clients apparaîtront ici.</div>
              <Link href="/dashboard/horaires" style={{padding:"8px 18px",borderRadius:9,background:"var(--g)",color:"#fff",fontSize:12,fontWeight:600,textDecoration:"none"}}>
                Créer des créneaux →
              </Link>
            </div>
          ) : (
            bookings.map((b, i) => (
              <div
                key={b.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px",
                  borderBottom: i < bookings.length - 1 ? "1px solid rgba(255,255,255,.03)" : "none",
                  // Amber highlight for bookings that need the owner's attention
                  background:  b.status === "PENDING" ? "rgba(245,166,35,.08)" : "transparent",
                  borderLeft:  b.status === "PENDING" ? "3px solid var(--amber)"       : "3px solid transparent",
                  transition: "all .2s ease",
                  opacity:    updating === b.id ? 0.6 : 1,
                  // Subtle pulse only while the booking is still pending and not being acted on
                  animation: b.status === "PENDING" && updating !== b.id ? "pulseSoft 2s infinite" : "none",
                }}
              >
                <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#503060,#301840)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontFamily:"var(--serif)",fontWeight:800,color:"#fff",flexShrink:0}}>
                  {b.service?.name?.[0] ?? "R"}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.service?.name ?? "Réservation"}</div>
                  <div style={{fontSize:11,color:"var(--text3)"}}>
                    {b.slot?.startsAt ? fmtDate(b.slot.startsAt) : fmtDate(b.createdAt)}
                  </div>
                </div>
                {b.service?.priceCents != null && (
                  <div style={{fontSize:12,fontWeight:700,color:"var(--g2)",whiteSpace:"nowrap"}}>{b.service.priceCents.toLocaleString("fr")} F</div>
                )}
                {b.status === "PENDING" && (
                  <div style={{display:"flex",gap:4,flexShrink:0}}>
                    <button
                      type="button"
                      disabled={updating === b.id}
                      onClick={() => updateStatus(b.id, "CONFIRMED")}
                      style={{padding:"4px 10px",borderRadius:6,border:"none",fontSize:10,fontWeight:600,cursor:"pointer",background:"rgba(34,211,138,.12)",color:"var(--g2)"}}
                    >
                      Accepter
                    </button>
                    <button
                      type="button"
                      disabled={updating === b.id}
                      onClick={() => updateStatus(b.id, "CANCELLED")}
                      style={{padding:"4px 10px",borderRadius:6,border:"none",fontSize:10,fontWeight:600,cursor:"pointer",background:"rgba(239,68,68,.1)",color:"var(--red)"}}
                    >
                      Refuser
                    </button>
                  </div>
                )}
                <span style={{fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:99,background:"rgba(34,211,138,.08)",color:STATUS_COLOR[b.status]??"var(--g2)",whiteSpace:"nowrap",flexShrink:0}}>
                  {STATUS_LABEL[b.status] ?? b.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulseSoft {
          0%   { box-shadow: 0 0 0 0   rgba(245,166,35,0.2); }
          70%  { box-shadow: 0 0 0 6px rgba(245,166,35,0);   }
          100% { box-shadow: 0 0 0 0   rgba(245,166,35,0);   }
        }
      `}</style>
    </div>
  );
}
