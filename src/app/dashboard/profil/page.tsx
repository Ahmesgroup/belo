"use client";
import { useState, useEffect } from "react";

const PLAN_LABELS: Record<string, { icon: string; label: string; desc: string }> = {
  FREE:    { icon:"🌱", label:"Plan Free",    desc:"20 réservations/mois · 3 services" },
  PRO:     { icon:"🚀", label:"Plan Pro",     desc:"500 réservations/mois · 20 services" },
  PREMIUM: { icon:"✦",  label:"Plan Premium", desc:"Illimité · Toutes fonctionnalités" },
};

export default function DashboardProfilPage() {
  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [address, setAddress] = useState("");
  const [city,    setCity]    = useState("");
  const [plan,    setPlan]    = useState("FREE");
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    const token = localStorage.getItem("belo_token");
    const user  = (() => { try { return JSON.parse(localStorage.getItem("belo_user") ?? ""); } catch { return null; } })();
    if (!token || !user?.tenantId) { setLoading(false); return; }
    fetch(`/api/tenants/${user.tenantId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          setName(d.data.name ?? "");
          setPhone(d.data.phone ?? "");
          setAddress(d.data.address ?? "");
          setCity(d.data.city ?? "");
          setPlan(d.data.plan ?? "FREE");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const token = localStorage.getItem("belo_token");
    const user  = (() => { try { return JSON.parse(localStorage.getItem("belo_user") ?? ""); } catch { return null; } })();
    if (!token || !user?.tenantId) { setError("Non connecté."); setSaving(false); return; }
    try {
      const res = await fetch(`/api/tenants/${user.tenantId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ name, phone, address, city }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error?.message ?? "Erreur."); return; }
      setSaved(true);
      window.dispatchEvent(new CustomEvent("tenant-updated"));
      setTimeout(() => setSaved(false), 2500);
    } catch { setError("Erreur réseau."); }
    finally { setSaving(false); }
  }

  const planInfo = PLAN_LABELS[plan] ?? PLAN_LABELS.FREE;

  return (
    <div style={{padding:"18px 22px",maxWidth:560}}>
      <h1 style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700,marginBottom:20,color:"var(--text)"}}>Mon profil</h1>

      {loading ? (
        <div style={{padding:"24px",textAlign:"center",fontSize:13,color:"var(--text3)"}}>Chargement…</div>
      ) : (
        <form onSubmit={handleSave} style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:20,display:"flex",flexDirection:"column",gap:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em"}}>Informations du salon</div>

            {[
              { label:"Nom du salon",        value:name,    set:setName,    placeholder:"Ex: Studio Aminata Beauty", type:"text" },
              { label:"Téléphone WhatsApp",  value:phone,   set:setPhone,   placeholder:"+221 77 123 45 67",        type:"tel" },
              { label:"Adresse",             value:address, set:setAddress, placeholder:"Rue 10, Almadies",         type:"text" },
              { label:"Ville",               value:city,    set:setCity,    placeholder:"Dakar",                    type:"text" },
            ].map(f => (
              <div key={f.label}>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:"var(--text3)",marginBottom:5}}>{f.label}</label>
                <input
                  type={f.type} value={f.value} placeholder={f.placeholder}
                  onChange={e => f.set(e.target.value)}
                  style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1px solid var(--border2)",background:"rgba(255,255,255,.04)",fontSize:13,color:"var(--text)",boxSizing:"border-box"}}
                />
              </div>
            ))}
          </div>

          <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>Plan actuel</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{planInfo.icon} {planInfo.label}</span>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:3}}>{planInfo.desc}</div>
              </div>
              {plan === "FREE" && (
                <a href="/plans" style={{padding:"8px 16px",borderRadius:9,background:"var(--g)",color:"#fff",fontSize:11,fontWeight:700,textDecoration:"none"}}>
                  Passer à Pro →
                </a>
              )}
            </div>
          </div>

          {error && <div style={{fontSize:12,color:"var(--red)",padding:"8px 12px",background:"rgba(239,68,68,.06)",borderRadius:8,border:"1px solid rgba(239,68,68,.2)"}}>{error}</div>}

          <button type="submit" disabled={saving} style={{padding:"12px",borderRadius:10,border:"none",background:saved?"rgba(34,211,138,.15)":"var(--g)",color:saved?"var(--g2)":"#fff",fontFamily:"var(--serif)",fontSize:14,fontWeight:700,cursor:"pointer",transition:".2s"}}>
            {saving ? "Sauvegarde…" : saved ? "✓ Enregistré" : "Enregistrer les modifications"}
          </button>
        </form>
      )}
    </div>
  );
}
