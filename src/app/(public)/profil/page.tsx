"use client";
import { useState, useEffect } from "react";
import { PublicNav } from "@/components/ui/Nav";
import Link from "next/link";

type Booking = { id: string; status: string; createdAt: string; service?: { name: string; priceCents: number }; slot?: { startsAt: string } };
type Tenant  = { id: string; name: string; slug: string; city: string | null; plan: string };
type User    = { id: string; name: string; phone: string; role: string; tenantId?: string };

const STATUS_LABEL: Record<string, string> = {
  PENDING:"En attente", CONFIRMED:"Confirmé", COMPLETED:"Terminé", CANCELLED:"Annulé", NO_SHOW:"Absent"
};

export default function ProfilPage() {
  const [tab, setTab] = useState(0);
  const [user, setUser] = useState<User | null>(null);

  const [bookings,  setBookings]  = useState<Booking[]>([]);
  const [bLoading,  setBLoading]  = useState(false);
  const [salons,    setSalons]    = useState<Tenant[]>([]);
  const [sLoading,  setSLoading]  = useState(false);

  // Load user from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("belo_user");
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  // Historique: fetch bookings when tab=2
  useEffect(() => {
    if (tab !== 2) return;
    setBLoading(true);
    const token = localStorage.getItem("belo_token");
    const u: User | null = (() => { try { return JSON.parse(localStorage.getItem("belo_user") ?? ""); } catch { return null; } })();
    const query = u?.tenantId ? `?tenantId=${u.tenantId}` : "";
    fetch(`/api/bookings${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => { if (d.data?.bookings) setBookings(d.data.bookings); })
      .catch(() => {})
      .finally(() => setBLoading(false));
  }, [tab]);

  // Salons: fetch when tab=1
  useEffect(() => {
    if (tab !== 1) return;
    setSLoading(true);
    fetch("/api/tenants?pageSize=20")
      .then(r => r.json())
      .then(d => { if (d.data?.tenants) setSalons(d.data.tenants); })
      .catch(() => {})
      .finally(() => setSLoading(false));
  }, [tab]);

  function logout() {
    localStorage.removeItem("belo_user");
    localStorage.removeItem("belo_token");
    window.location.href = "/";
  }

  const displayName = user?.name ?? "Mon compte";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <PublicNav />
      <main style={{paddingTop:56}}>
        <div style={{maxWidth:430,margin:"0 auto",padding:"24px 16px 60px"}}>

          {/* Avatar */}
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,var(--g2),var(--blue))",padding:3,margin:"0 auto 10px"}}>
              <div style={{width:"100%",height:"100%",borderRadius:"50%",background:"linear-gradient(135deg,#503060,#301840)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--serif)",fontSize:28,fontWeight:800,color:"#fff"}}>{initial}</div>
            </div>
            <div style={{fontFamily:"var(--serif)",fontWeight:800,fontSize:20,marginBottom:2}}>{displayName}</div>
            {user?.phone && <div style={{fontSize:11,color:"var(--text3)"}}>+221 {user.phone.replace(/^\+221/,"")}</div>}
          </div>

          {/* Tabs */}
          <div style={{display:"flex",gap:0,background:"var(--bg2)",borderRadius:10,padding:3,marginBottom:16}}>
            {["Profil","Salons","Historique","Réglages"].map((t,i) => (
              <button key={t} onClick={() => setTab(i)} style={{flex:1,padding:8,borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",border:"none",background:tab===i?"var(--card)":"transparent",color:tab===i?"var(--text)":"var(--text3)",transition:".2s"}}>
                {t}
              </button>
            ))}
          </div>

          {/* PROFIL */}
          {tab === 0 && (
            <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:16}}>
              {user ? (
                <>
                  <div style={{marginBottom:12}}>
                    <label style={{display:"block",fontSize:9,fontWeight:700,color:"var(--text3)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>Nom</label>
                    <input defaultValue={user.name} style={{width:"100%",boxSizing:"border-box"}} readOnly />
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{display:"block",fontSize:9,fontWeight:700,color:"var(--text3)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:5}}>WhatsApp</label>
                    <input defaultValue={user.phone} type="tel" style={{width:"100%",boxSizing:"border-box"}} readOnly />
                  </div>
                  <div style={{fontSize:11,color:"var(--text3)",padding:"8px 12px",background:"rgba(255,255,255,.03)",borderRadius:8}}>
                    Rôle : <strong>{user.role}</strong>
                  </div>
                </>
              ) : (
                <div style={{textAlign:"center",padding:"20px 0",fontSize:13,color:"var(--text3)"}}>
                  <Link href="/login" style={{color:"var(--g2)",textDecoration:"none",fontWeight:600}}>Connectez-vous</Link> pour voir votre profil.
                </div>
              )}
            </div>
          )}

          {/* SALONS */}
          {tab === 1 && (
            <div>
              {sLoading && <div style={{textAlign:"center",padding:"32px 0",color:"var(--text3)",fontSize:13}}>Chargement…</div>}
              {!sLoading && salons.length === 0 && (
                <div style={{textAlign:"center",padding:"32px 0",color:"var(--text3)",fontSize:13}}>Aucun salon trouvé.</div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {salons.map(s => (
                  <div key={s.id} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:14,display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#1a2a1a,#0d2d1a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>💇‍♀️</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{s.name}</div>
                      {s.city && <div style={{fontSize:11,color:"var(--text3)"}}>📍 {s.city}</div>}
                    </div>
                    <Link href={`/booking/${s.slug}`} style={{padding:"7px 14px",borderRadius:8,background:"var(--g)",color:"#fff",fontSize:11,fontWeight:600,textDecoration:"none",whiteSpace:"nowrap"}}>
                      Réserver →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HISTORIQUE */}
          {tab === 2 && (
            <div>
              {!user && (
                <div style={{textAlign:"center",padding:"32px 0",fontSize:13,color:"var(--text3)"}}>
                  <Link href="/login" style={{color:"var(--g2)",textDecoration:"none",fontWeight:600}}>Connectez-vous</Link> pour voir vos réservations.
                </div>
              )}
              {user && bLoading && <div style={{textAlign:"center",padding:"32px 0",color:"var(--text3)",fontSize:13}}>Chargement…</div>}
              {user && !bLoading && bookings.length === 0 && (
                <div style={{textAlign:"center",padding:"32px 0"}}>
                  <div style={{fontSize:32,marginBottom:12}}>📅</div>
                  <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>Aucune réservation</div>
                  <p style={{fontSize:12,color:"var(--text3)",marginBottom:16}}>Vos réservations apparaîtront ici.</p>
                  <Link href="/salons" style={{padding:"9px 20px",borderRadius:10,background:"var(--g)",color:"#fff",fontSize:12,fontWeight:700,textDecoration:"none"}}>Trouver un salon</Link>
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {bookings.map(b => (
                  <div key={b.id} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div style={{fontSize:13,fontWeight:600}}>{b.service?.name ?? "Réservation"}</div>
                      <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,background:"rgba(34,211,138,.1)",color:"var(--g2)"}}>{STATUS_LABEL[b.status] ?? b.status}</span>
                    </div>
                    {b.slot?.startsAt && <div style={{fontSize:11,color:"var(--text3)"}}>📅 {new Date(b.slot.startsAt).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>}
                    {b.service?.priceCents && <div style={{fontSize:12,fontWeight:700,color:"var(--g2)",marginTop:4}}>{b.service.priceCents.toLocaleString("fr")} FCFA</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RÉGLAGES */}
          {tab === 3 && (
            <div>
              <button
                onClick={logout}
                style={{width:"100%",padding:12,borderRadius:9,border:"1px solid var(--border2)",background:"transparent",color:"var(--text2)",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:12}}
              >
                🚪 Se déconnecter
              </button>
              <div style={{background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.2)",borderRadius:12,padding:14}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--red)",marginBottom:10}}>Zone sensible</div>
                <button style={{width:"100%",padding:9,borderRadius:8,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",color:"var(--red)",fontSize:12,cursor:"pointer"}}>
                  🗑 Supprimer mon compte
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
