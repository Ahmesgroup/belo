"use client";
import { useState, useEffect } from "react";
import { getUser, authHeaders, jsonAuthHeaders } from "@/lib/auth-client";

export default function EquipePage() {
  const [staff,    setStaff]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [newName,  setNewName]  = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding,   setAdding]   = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [plan,     setPlan]     = useState("");

  async function fetchStaff() {
    setLoading(true);
    const user = getUser();
    const res = await fetch(`/api/staff?tenantId=${user?.tenantId}`, { headers: authHeaders() });
    const data = await res.json();
    setStaff(data.data?.staff ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const user = getUser();
    if (!user?.tenantId) { setLoading(false); return; }
    fetch(`/api/tenants/${user.tenantId}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setPlan(d.data?.plan ?? "FREE"))
      .catch(() => {});
    fetchStaff();
  }, []);

  async function addStaff() {
    if (!newName.trim() || !newPhone.trim()) return;
    setAdding(true); setError("");
    const res = await fetch("/api/staff", {
      method:  "POST",
      headers: jsonAuthHeaders(),
      body:    JSON.stringify({ name: newName.trim(), phone: newPhone.trim() }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) {
      setError(data.error?.message ?? "Erreur lors de l'ajout.");
    } else {
      setSuccess(`${newName} ajouté(e) à votre équipe.`);
      setNewName(""); setNewPhone("");
      fetchStaff();
      setTimeout(() => setSuccess(""), 4000);
    }
  }

  async function removeStaff(staffId: string, name: string) {
    if (!confirm(`Retirer ${name} de votre équipe ?`)) return;
    await fetch(`/api/staff?staffId=${staffId}`, { method: "DELETE", headers: authHeaders() });
    fetchStaff();
  }

  if (plan && plan !== "PREMIUM") {
    return (
      <div style={{padding:32,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:12}}>👥</div>
        <div style={{fontSize:16,fontWeight:600,color:"var(--text)",marginBottom:8}}>Fonctionnalité Premium</div>
        <div style={{fontSize:13,color:"var(--text3)",marginBottom:20}}>La gestion d'équipe est disponible avec le plan Premium.</div>
        <a href="/plans" style={{padding:"10px 24px",background:"var(--g2)",color:"#000",borderRadius:10,fontWeight:700,fontSize:13,textDecoration:"none"}}>Passer Premium →</a>
      </div>
    );
  }

  return (
    <div style={{padding:"24px 20px",maxWidth:600}}>
      <h1 style={{fontSize:20,fontWeight:700,color:"var(--text)",marginBottom:4}}>Mon équipe</h1>
      <p style={{fontSize:13,color:"var(--text3)",marginBottom:24}}>Ajoutez vos employés. Ils pourront se connecter et gérer les réservations.</p>

      <div style={{background:"var(--card)",borderRadius:14,padding:20,marginBottom:24,border:"1px solid var(--border)"}}>
        <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:14}}>+ Ajouter un employé</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input placeholder="Nom complet" value={newName} onChange={e=>setNewName(e.target.value)}
            style={{padding:"10px 14px",borderRadius:10,border:"1px solid var(--border2)",background:"var(--bg2)",color:"var(--text)",fontSize:13}} />
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{padding:"10px 12px",borderRadius:10,border:"1px solid var(--border2)",background:"var(--bg2)",color:"var(--text3)",fontSize:13,whiteSpace:"nowrap",flexShrink:0}}>+221</span>
            <input placeholder="77 123 45 67" value={newPhone} onChange={e=>setNewPhone(e.target.value)}
              style={{flex:1,padding:"10px 14px",borderRadius:10,border:"1px solid var(--border2)",background:"var(--bg2)",color:"var(--text)",fontSize:13}} />
          </div>
          {error   && <div style={{color:"var(--red)",fontSize:12}}>{error}</div>}
          {success && <div style={{color:"var(--g2)",fontSize:12}}>✓ {success}</div>}
          <button type="button" onClick={addStaff} disabled={adding||!newName||!newPhone}
            style={{padding:12,borderRadius:10,background:(!newName||!newPhone||adding)?"var(--border2)":"var(--g2)",color:(!newName||!newPhone||adding)?"var(--text3)":"#000",fontWeight:700,fontSize:13,border:"none",cursor:"pointer"}}>
            {adding ? "Ajout en cours…" : "Ajouter à l'équipe"}
          </button>
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {loading ? (
          <div style={{color:"var(--text3)",fontSize:13,textAlign:"center",padding:20}}>Chargement…</div>
        ) : staff.length === 0 ? (
          <div style={{color:"var(--text3)",fontSize:13,textAlign:"center",padding:20,background:"var(--card)",borderRadius:14,border:"1px solid var(--border)"}}>Aucun employé pour l'instant.</div>
        ) : staff.map(s => (
          <div key={s.id} style={{display:"flex",alignItems:"center",gap:14,background:"var(--card)",borderRadius:12,padding:"14px 16px",border:"1px solid var(--border)"}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(34,211,138,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"var(--g2)",flexShrink:0}}>
              {s.name.charAt(0).toUpperCase()}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{s.name}</div>
              <div style={{fontSize:11,color:"var(--text3)"}}>{s.phone}</div>
            </div>
            <span style={{fontSize:10,background:"rgba(34,211,138,.1)",color:"var(--g2)",padding:"3px 8px",borderRadius:99,fontWeight:600}}>STAFF</span>
            <button type="button" onClick={()=>removeStaff(s.id,s.name)}
              style={{background:"transparent",border:"1px solid rgba(239,68,68,.3)",borderRadius:8,padding:"6px 12px",color:"var(--red)",fontSize:11,cursor:"pointer"}}>
              Retirer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
