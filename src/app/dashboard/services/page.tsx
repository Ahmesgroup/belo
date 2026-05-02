"use client";
import { useState, useEffect } from "react";

type Service = { id: string; name: string; category: string; priceCents: number; durationMin: number; isActive: boolean; photos: string[] };

const PLAN_LIMITS: Record<string, number> = { FREE: 3, PRO: 20, PREMIUM: 999 };
const CAT_ICONS:   Record<string, string>  = { hair:"💇‍♀️", HAIR:"💇‍♀️", nails:"💅", NAILS:"💅", massage:"💆‍♀️", MASSAGE:"💆‍♀️", barber:"✂️", BARBER:"✂️", spa:"🧖‍♀️", other:"✦" };
function fmt(min: number) { return min >= 60 ? `${Math.floor(min/60)}h${min%60?String(min%60).padStart(2,"0"):""}` : `${min}min`; }

const CATEGORIES = [
  {value:"hair",    label:"💇‍♀️ Coiffure"},
  {value:"nails",   label:"💅 Ongles"},
  {value:"massage", label:"💆‍♀️ Massage"},
  {value:"barber",  label:"✂️ Barbershop"},
  {value:"spa",     label:"🧖 Spa"},
  {value:"beauty",  label:"🧴 Beauté"},
  {value:"other",   label:"✦ Autre"},
];

export default function ServicesPage() {
  const [services,      setServices]      = useState<Service[]>([]);
  const [plan,          setPlan]          = useState("FREE");
  const [loading,       setLoading]       = useState(true);
  const [refresh,       setRefresh]       = useState(0);
  const [editId,        setEditId]        = useState<string | null>(null);
  const [editForm,      setEditForm]      = useState({ name: "", priceCents: 0, durationMin: 60 });
  const [saving,        setSaving]        = useState(false);
  const [saveErr,       setSaveErr]       = useState("");
  const [showCreate,    setShowCreate]    = useState(false);
  const [createForm,    setCreateForm]    = useState({ name: "", priceCents: "", durationMin: "60", category: "hair" });
  const [creating,      setCreating]      = useState(false);
  const [createErr,     setCreateErr]     = useState("");

  useEffect(() => {
    const token = localStorage.getItem("belo_token");
    const user  = (() => { try { return JSON.parse(localStorage.getItem("belo_user") ?? ""); } catch { return null; } })();
    if (!token || !user?.tenantId) { setLoading(false); return; }

    Promise.all([
      fetch(`/api/services?tenantId=${user.tenantId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`/api/tenants/${user.tenantId}`,           { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([svcData, tenantData]) => {
      if (svcData.data?.services)   setServices(svcData.data.services);
      if (tenantData.data?.plan)    setPlan(tenantData.data.plan);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [refresh]);

  async function createService() {
    if (!createForm.name.trim() || !createForm.priceCents) { setCreateErr("Nom et prix requis."); return; }
    setCreating(true); setCreateErr("");
    const token = localStorage.getItem("belo_token");
    const user  = (() => { try { return JSON.parse(localStorage.getItem("belo_user") ?? ""); } catch { return null; } })();
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}`, "x-tenant-id": user?.tenantId ?? "" },
        body: JSON.stringify({
          name:        createForm.name.trim(),
          priceCents:  Math.round(parseFloat(createForm.priceCents) || 0),
          durationMin: parseInt(createForm.durationMin) || 60,
          category:    createForm.category,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateErr(data.error?.message ?? "Erreur."); return; }
      setShowCreate(false);
      setCreateForm({ name: "", priceCents: "", durationMin: "60", category: "hair" });
      setRefresh(r => r + 1);
      window.dispatchEvent(new CustomEvent("tenant-updated"));
    } catch { setCreateErr("Erreur réseau."); }
    finally { setCreating(false); }
  }

  function startEdit(s: Service) {
    setEditId(s.id);
    setSaveErr("");
    setEditForm({ name: s.name, priceCents: s.priceCents, durationMin: s.durationMin });
  }

  async function saveEdit(id: string) {
    setSaving(true); setSaveErr("");
    const token = localStorage.getItem("belo_token");
    try {
      const res  = await fetch(`/api/services/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) { setSaveErr(data.error?.message ?? "Erreur."); return; }
      setServices(s => s.map(x => x.id === id ? { ...x, ...data.data } : x));
      setEditId(null);
      window.dispatchEvent(new CustomEvent("tenant-updated"));
    } catch { setSaveErr("Erreur réseau."); }
    finally { setSaving(false); }
  }

  const maxServices = PLAN_LIMITS[plan] ?? 3;
  const atLimit     = services.length >= maxServices;

  return (
    <div style={{padding:"18px 22px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h1 style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700}}>Mes services</h1>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,color:"var(--amber)",background:"rgba(245,166,35,.1)",padding:"4px 10px",borderRadius:99}}>
            {services.length}/{maxServices === 999 ? "∞" : maxServices} service{services.length !== 1 ? "s" : ""}
          </span>
          {!atLimit && (
            <button onClick={() => { setShowCreate(!showCreate); setCreateErr(""); }} style={{padding:"8px 16px",borderRadius:9,background:showCreate?"var(--border2)":"var(--g)",color:"#fff",fontSize:12,fontWeight:600,border:"none",cursor:"pointer"}}>
              {showCreate ? "✕ Annuler" : "+ Ajouter"}
            </button>
          )}
        </div>
      </div>

      {loading && <div style={{padding:"24px",textAlign:"center",fontSize:13,color:"var(--text3)"}}>Chargement…</div>}

      {!loading && services.map(s => (
        <div key={s.id} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:16,marginBottom:10}}>
          {editId === s.id ? (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nom du service"
                style={{padding:"9px 12px",borderRadius:8,border:"1px solid var(--border2)",background:"rgba(255,255,255,.04)",fontSize:13,color:"var(--text)"}}
              />
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{display:"block",fontSize:10,color:"var(--text3)",marginBottom:4}}>Prix (FCFA)</label>
                  <input
                    type="number" value={editForm.priceCents}
                    onChange={e => setEditForm(f => ({ ...f, priceCents: Number(e.target.value) }))}
                    style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid var(--border2)",background:"rgba(255,255,255,.04)",fontSize:13,color:"var(--text)",boxSizing:"border-box"}}
                  />
                </div>
                <div>
                  <label style={{display:"block",fontSize:10,color:"var(--text3)",marginBottom:4}}>Durée (min)</label>
                  <input
                    type="number" value={editForm.durationMin}
                    onChange={e => setEditForm(f => ({ ...f, durationMin: Number(e.target.value) }))}
                    style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid var(--border2)",background:"rgba(255,255,255,.04)",fontSize:13,color:"var(--text)",boxSizing:"border-box"}}
                  />
                </div>
              </div>
              {saveErr && <div style={{fontSize:11,color:"var(--red)"}}>{saveErr}</div>}
              <div style={{display:"flex",gap:8}}>
                <button onClick={() => saveEdit(s.id)} disabled={saving} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:"var(--g)",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                  {saving ? "Sauvegarde…" : "✓ Enregistrer"}
                </button>
                <button onClick={() => setEditId(null)} style={{padding:"9px 14px",borderRadius:8,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:12,cursor:"pointer"}}>
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:40,height:40,borderRadius:8,background:"rgba(34,211,138,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                {CAT_ICONS[s.category] ?? "✦"}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,marginBottom:2}}>{s.name}</div>
                <div style={{fontSize:11,color:"var(--text3)"}}>⏱ {fmt(s.durationMin)}</div>
              </div>
              <div style={{fontFamily:"var(--serif)",fontSize:16,fontWeight:700,color:"var(--g2)"}}>{s.priceCents.toLocaleString("fr")} F</div>
              <button onClick={() => startEdit(s)} style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:11,cursor:"pointer"}}>
                Éditer
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Inline create form */}
      {showCreate && !atLimit && (
        <div style={{background:"var(--card)",border:"1px solid rgba(34,211,138,.25)",borderRadius:12,padding:16,marginBottom:10}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--g2)",marginBottom:12}}>✦ Nouveau service</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <input value={createForm.name} onChange={e=>setCreateForm(f=>({...f,name:e.target.value}))} placeholder="Nom du service" style={{padding:"9px 12px",borderRadius:8,border:"1px solid var(--border2)",background:"rgba(255,255,255,.04)",fontSize:13,color:"var(--text)"}} />
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <div>
                <label style={{display:"block",fontSize:10,color:"var(--text3)",marginBottom:3}}>Prix (FCFA)</label>
                <input type="number" value={createForm.priceCents} onChange={e=>setCreateForm(f=>({...f,priceCents:e.target.value}))} placeholder="15000" style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid var(--border2)",background:"rgba(255,255,255,.04)",fontSize:12,color:"var(--text)",boxSizing:"border-box"}} />
              </div>
              <div>
                <label style={{display:"block",fontSize:10,color:"var(--text3)",marginBottom:3}}>Durée (min)</label>
                <input type="number" value={createForm.durationMin} onChange={e=>setCreateForm(f=>({...f,durationMin:e.target.value}))} placeholder="60" style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid var(--border2)",background:"rgba(255,255,255,.04)",fontSize:12,color:"var(--text)",boxSizing:"border-box"}} />
              </div>
              <div>
                <label style={{display:"block",fontSize:10,color:"var(--text3)",marginBottom:3}}>Catégorie</label>
                <select title="Catégorie du service" value={createForm.category} onChange={e=>setCreateForm(f=>({...f,category:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid var(--border2)",background:"rgba(255,255,255,.04)",fontSize:12,color:"var(--text)",boxSizing:"border-box"}}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            {createErr && <div style={{fontSize:11,color:"var(--red)"}}>{createErr}</div>}
            <button onClick={createService} disabled={creating} style={{padding:"9px",borderRadius:8,border:"none",background:"var(--g)",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              {creating ? "Création…" : "✓ Créer le service"}
            </button>
          </div>
        </div>
      )}

      {!loading && services.length === 0 && (
        <div style={{background:"rgba(255,255,255,.03)",border:"1px dashed var(--border2)",borderRadius:12,padding:24,textAlign:"center"}}>
          <div style={{fontSize:20,marginBottom:8}}>✦</div>
          <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Aucun service encore</div>
          <div style={{fontSize:12,color:"var(--text3)"}}>Ajoutez votre premier service pour que les clients puissent réserver.</div>
        </div>
      )}

      {!loading && atLimit && services.length > 0 && (
        <div style={{background:"rgba(144,96,232,.04)",border:"1px dashed rgba(144,96,232,.2)",borderRadius:12,padding:20,textAlign:"center",marginTop:10}}>
          <div style={{fontSize:20,marginBottom:8}}>🔒</div>
          <div style={{fontWeight:600,marginBottom:4}}>Limite {maxServices} service{maxServices > 1 ? "s" : ""} atteinte</div>
          <div style={{fontSize:12,color:"var(--text3)",marginBottom:12}}>Passez à Pro pour créer jusqu'à 20 services.</div>
          <a href="/plans" style={{padding:"9px 20px",borderRadius:10,background:"var(--g)",color:"#fff",fontSize:12,fontWeight:700,textDecoration:"none"}}>Passer à Pro — 15 000 F/mois</a>
        </div>
      )}
    </div>
  );
}
