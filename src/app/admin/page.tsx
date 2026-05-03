"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth-client";
import { ADMIN_ROLES } from "@/lib/auth-guard";
import { apiFetch } from "@/lib/api-fetch";

// ── Types ────────────────────────────────────────────────────────
type Tenant   = { id:string; name:string; slug:string; city:string|null; plan:string; status:string; bookingsUsedMonth:number; _count:{bookings:number; fraudAlerts:number}; users:{name:string;phone:string}[] };
type PlanCfg  = { id:string; plan:string; priceFcfa:number; priceEur:number; priceFcfaAnnual:number; limits:any; features:any };
type FraudAlt = { id:string; status:string; riskScore:number; signals:any; notes:string|null; createdAt:string; tenant:{id:string;name:string;plan:string} };
type AuditLog = { id:string; action:string; entity:string; entityId:string; createdAt:string; actor:{name:string;role:string}|null; tenant:{name:string}|null; newValue:any };
type TeamMember = { id:string; name:string; phone:string; email:string|null; role:string; lastLoginAt:string|null; createdAt:string };

const VIEWS = ["Mission Control","Tenants","Plans","Fraude","Équipe","Logs","Réglages"];
const PLAN_COLOR: Record<string,string> = { FREE:"var(--text3)", PRO:"var(--blue)", PREMIUM:"var(--g2)" };
const STATUS_COLOR: Record<string,[string,string]> = {
  ACTIVE:   ["rgba(34,211,138,.1)","var(--g2)"],
  PENDING:  ["rgba(245,166,35,.1)","var(--amber)"],
  BLOCKED:  ["rgba(239,68,68,.1)","var(--red)"],
  SUSPENDED:["rgba(239,68,68,.08)","var(--red)"],
  FRAUD:    ["rgba(239,68,68,.2)","var(--red)"],
};
const FRAUD_COLOR: Record<string,[string,string]> = {
  NEW:          ["rgba(245,166,35,.12)","var(--amber)"],
  UNDER_REVIEW: ["rgba(59,126,246,.12)","var(--blue)"],
  ACTION_TAKEN: ["rgba(239,68,68,.12)","var(--red)"],
  CLOSED:       ["rgba(255,255,255,.06)","var(--text3)"],
};

function Pill({label,bg,color}:{label:string;bg:string;color:string}){
  return <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:99,background:bg,color}}>{label}</span>;
}

export default function AdminPage() {
  const router = useRouter();
  const [view,      setView]      = useState(0);
  const [adminOk,   setAdminOk]   = useState(false);
  const [isMobile,  setIsMobile]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [adminDate, setAdminDate] = useState("");
  const [toasts,    setToasts]    = useState<{id:number;msg:string;ok?:boolean}[]>([]);
  const currentUser = typeof window !== "undefined" ? getUser() : null;

  // — Mission Control & Tenants
  const [tenants,  setTenants]  = useState<Tenant[]>([]);
  const [stats,    setStats]    = useState<Record<string,number>>({});
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");

  // — Plans
  const [plans,       setPlans]       = useState<PlanCfg[]>([]);
  const [planStats,   setPlanStats]   = useState<Record<string,number>>({});
  const [editPlan,    setEditPlan]    = useState<string|null>(null);
  const [editVals,    setEditVals]    = useState<any>({});
  const [savingPlan,  setSavingPlan]  = useState(false);

  // — Fraud
  const [fraudList,    setFraudList]    = useState<FraudAlt[]>([]);
  const [fraudLoading, setFraudLoading] = useState(false);

  // — Team
  const [team,        setTeam]        = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  // — Logs
  const [logs,        setLogs]        = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsTotal,   setLogsTotal]   = useState(0);
  const [logsPage,    setLogsPage]    = useState(1);

  // — Settings
  const [settings,       setSettings]       = useState<Record<string,any>>({});
  const [settingsLoading,setSettingsLoading] = useState(false);
  const [settingsDraft,  setSettingsDraft]  = useState<Record<string,any>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  // ── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setAdminDate(new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}));
  }, []);

  useEffect(() => {
    const user = getUser();
    if (!user) { router.replace("/login"); return; }
    if (!(ADMIN_ROLES as readonly string[]).includes(user.role)) { router.replace("/"); return; }
    setAdminOk(true);
    loadTenants();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lazy load per view ──────────────────────────────────────────
  useEffect(() => {
    if (!adminOk) return;
    if (view === 2 && plans.length === 0) loadPlans();
    if (view === 3 && fraudList.length === 0) loadFraud();
    if (view === 4 && team.length === 0) loadTeam();
    if (view === 5) loadLogs(1);
    if (view === 6 && Object.keys(settings).length === 0) loadSettings();
  }, [view, adminOk]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toast ────────────────────────────────────────────────────────
  function toast(msg:string, ok=true) {
    const id = Date.now();
    setToasts(t => [...t,{id,msg,ok}]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }

  // ── Data loaders ─────────────────────────────────────────────────
  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/admin/tenants?pageSize=100");
      if (!r.ok) { if(r.status===401||r.status===403) router.replace("/"); return; }
      const d = await r.json();
      setTenants(d.data?.tenants ?? []);
      setStats(d.data?.stats ?? {});
    } catch { toast("Erreur chargement tenants",false); }
    finally { setLoading(false); }
  },[router]);

  async function loadPlans() {
    const [r1,r2,r3,r4] = await Promise.all([
      apiFetch("/api/plans").then(r=>r.json()),
      apiFetch("/api/admin/tenants?plan=FREE&pageSize=1").then(r=>r.json()),
      apiFetch("/api/admin/tenants?plan=PRO&pageSize=1").then(r=>r.json()),
      apiFetch("/api/admin/tenants?plan=PREMIUM&pageSize=1").then(r=>r.json()),
    ]);
    setPlans(r1.data?.plans ?? []);
    setPlanStats({ FREE: r2.data?.pagination?.total??0, PRO: r3.data?.pagination?.total??0, PREMIUM: r4.data?.pagination?.total??0 });
  }

  async function loadFraud() {
    setFraudLoading(true);
    try {
      const r = await apiFetch("/api/admin/fraud?pageSize=50");
      const d = await r.json();
      setFraudList(d.data?.alerts ?? []);
    } catch { toast("Erreur fraude",false); }
    finally { setFraudLoading(false); }
  }

  async function loadTeam() {
    setTeamLoading(true);
    try {
      const r = await apiFetch("/api/admin/team");
      const d = await r.json();
      setTeam(d.data?.team ?? []);
    } catch { toast("Erreur équipe",false); }
    finally { setTeamLoading(false); }
  }

  async function loadLogs(page=1) {
    setLogsLoading(true); setLogsPage(page);
    try {
      const r = await apiFetch(`/api/admin/logs?page=${page}&pageSize=40`);
      const d = await r.json();
      setLogs(d.data?.logs ?? []);
      setLogsTotal(d.data?.pagination?.total ?? 0);
    } catch { toast("Erreur logs",false); }
    finally { setLogsLoading(false); }
  }

  async function loadSettings() {
    setSettingsLoading(true);
    try {
      const r = await apiFetch("/api/admin/settings");
      const d = await r.json();
      setSettings(d.data?.settings ?? {});
      setSettingsDraft(d.data?.settings ?? {});
    } catch { toast("Erreur settings",false); }
    finally { setSettingsLoading(false); }
  }

  // ── Actions ──────────────────────────────────────────────────────
  async function tenantAction(tenantId:string, action:string, extra?:Record<string,unknown>) {
    const r = await apiFetch(`/api/admin/tenants?action=do-action&id=${encodeURIComponent(tenantId)}`,{
      method:"POST", body: JSON.stringify({action,...extra}),
    });
    if (r.ok) { toast(`✓ Action "${action}" effectuée`); loadTenants(); }
    else { const d=await r.json(); toast(d.error?.message??`Erreur ${r.status}`,false); }
  }

  async function savePlan() {
    setSavingPlan(true);
    const r = await apiFetch("/api/plans",{method:"PATCH",body:JSON.stringify({plan:editPlan,...editVals})});
    setSavingPlan(false);
    if (r.ok) { toast("✓ Plan mis à jour"); setEditPlan(null); loadPlans(); }
    else { const d=await r.json(); toast(d.error?.message??"Erreur",false); }
  }

  async function fraudAction(id:string, status:string) {
    const r = await apiFetch(`/api/admin/fraud?id=${id}`,{method:"PATCH",body:JSON.stringify({status})});
    if (r.ok) { toast(`✓ Alerte → ${status}`); loadFraud(); }
    else toast("Erreur",false);
  }

  async function saveSettings() {
    setSavingSettings(true);
    const r = await apiFetch("/api/admin/settings",{method:"PATCH",body:JSON.stringify(settingsDraft)});
    setSavingSettings(false);
    if (r.ok) { toast("✓ Paramètres sauvegardés"); setSettings(settingsDraft); }
    else { const d=await r.json(); toast(d.error?.message??"Erreur",false); }
  }

  // ── Guard ─────────────────────────────────────────────────────────
  if (!adminOk) return (
    <div style={{display:"flex",height:"100vh",alignItems:"center",justifyContent:"center",background:"#070b10"}}>
      <div style={{color:"rgba(255,255,255,.3)",fontSize:13}}>Vérification des droits…</div>
    </div>
  );

  const filteredTenants = tenants.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.city?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{display:"flex",flexDirection:isMobile?"column":"row",minHeight:"100vh",height:isMobile?"auto":"100vh",overflow:isMobile?"visible":"hidden",background:"#07080d",color:"var(--text)"}}>

      {/* Sidebar */}
      {!isMobile && (
        <aside style={{width:240,background:"#070b10",borderRight:"1px solid rgba(30,40,55,.8)",display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"16px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid var(--border)"}}>
            <div style={{width:30,height:30,background:"linear-gradient(135deg,#e24b4a,#800)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⚡</div>
            <div>
              <div style={{fontFamily:"var(--serif)",fontWeight:800,fontSize:15}}>belo<span style={{color:"#e24b4a"}}>.</span></div>
              <div style={{fontSize:9,color:"#e24b4a",letterSpacing:".06em"}}>Super Admin</div>
            </div>
          </div>
          <div style={{margin:"10px 12px 0",padding:"4px 10px",background:"rgba(34,211,138,.08)",border:"1px solid rgba(34,211,138,.18)",borderRadius:8,fontSize:9,fontWeight:700,color:"var(--g2)",letterSpacing:".08em",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <span style={{width:5,height:5,borderRadius:"50%",background:"var(--g2)",animation:"pulse 2s infinite"}} />
            {Object.values(stats).reduce((a:number,b:any)=>a+b,0)} tenants · Live
          </div>
          <nav style={{padding:"8px 0",flex:1}}>
            {[["▦","Mission Control",0],["🏢","Tenants",1],["💳","Plans",2],["🛡️","Fraude",3],["👥","Équipe",4],["📋","Logs",5],["⚙️","Réglages",6]].map(([icon,label,idx]) => (
              <div key={label as string} onClick={() => setView(idx as number)} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 16px",fontSize:12,color:view===idx?"var(--g2)":"var(--text3)",background:view===idx?"rgba(34,211,138,.1)":"transparent",cursor:"pointer",transition:".15s",borderLeft:view===idx?"3px solid var(--g2)":"3px solid transparent",marginBottom:1}}>
                <span style={{fontSize:13,width:17,textAlign:"center"}}>{icon}</span>{label}
                {idx===3 && fraudList.filter(f=>f.status==="NEW").length>0 && (
                  <span style={{marginLeft:"auto",background:"#e24b4a",color:"#fff",fontSize:8,fontWeight:800,padding:"1px 5px",borderRadius:99}}>{fraudList.filter(f=>f.status==="NEW").length}</span>
                )}
              </div>
            ))}
          </nav>
          <div style={{padding:"10px 8px",borderTop:"1px solid var(--border)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#e24b4a,#800)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff"}}>
                {currentUser?.name?.[0]?.toUpperCase() ?? "A"}
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"var(--text)"}}>{currentUser?.name ?? "Admin"}</div>
                <div style={{fontSize:9,color:"#e24b4a"}}>{currentUser?.role ?? "ADMIN"}</div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile top bar */}
      {isMobile && (
        <div style={{position:"sticky",top:0,zIndex:100,background:"#070b10",borderBottom:"1px solid rgba(255,255,255,.08)",padding:"0 16px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontFamily:"var(--serif)",fontWeight:800,fontSize:15}}>belo<span style={{color:"#e24b4a"}}>.</span> <span style={{fontSize:9,color:"#e24b4a",fontWeight:600}}>ADMIN</span></div>
          <button type="button" onClick={() => setMenuOpen(!menuOpen)} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"6px 12px",color:"rgba(255,255,255,.7)",fontSize:11,cursor:"pointer"}}>
            {VIEWS[view]} ▾
          </button>
          {menuOpen && (
            <div style={{position:"fixed",top:52,left:0,right:0,bottom:0,background:"#070b10",zIndex:200,padding:16,overflowY:"auto"}}>
              {VIEWS.map((label,idx) => (
                <div key={label} onClick={() => {setView(idx);setMenuOpen(false);}} style={{padding:"16px 12px",fontSize:14,cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,.06)",color:view===idx?"var(--g2)":"rgba(255,255,255,.6)",fontWeight:view===idx?600:400}}>
                  {["▦","🏢","💳","🛡️","👥","📋","⚙️"][idx]} {label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Topbar */}
        <div style={{padding:"10px 20px",borderBottom:"1px solid var(--border)",background:"var(--card2)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexShrink:0}}>
          <div>
            <div style={{fontFamily:"var(--serif)",fontWeight:700,fontSize:14}}>{VIEWS[view]}</div>
            <div style={{fontSize:10,color:"var(--text3)"}}>Belo Admin · {adminDate}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <button type="button" onClick={loadTenants} style={{padding:"6px 12px",borderRadius:7,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:11,cursor:"pointer"}}>↻ Refresh</button>
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>

          {/* ═══ VIEW 0 — MISSION CONTROL ═══ */}
          {view === 0 && (
            <>
              {/* KPIs */}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)",gap:10}}>
                {[
                  {lbl:"Total salons",   val:loading?"…":String(Object.values(stats).reduce((a:number,b:any)=>a+b,0)||tenants.length), color:"var(--g2)"},
                  {lbl:"Actifs",         val:loading?"…":String(stats.ACTIVE??0),   color:"var(--g2)"},
                  {lbl:"En attente",     val:loading?"…":String(stats.PENDING??0),  color:"var(--amber)"},
                  {lbl:"Bloqués",        val:loading?"…":String(stats.BLOCKED??0),  color:"var(--red)"},
                  {lbl:"Fraude",         val:loading?"…":String(fraudList.filter(f=>f.status==="NEW").length), color:"#e24b4a"},
                ].map(k => (
                  <div key={k.lbl} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:11,padding:14}}>
                    <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:7}}>{k.lbl}</div>
                    <div style={{fontFamily:"var(--serif)",fontSize:24,fontWeight:800,lineHeight:1,color:k.color}}>{k.val}</div>
                  </div>
                ))}
              </div>

              {/* Quick actions — pending tenants */}
              {!loading && tenants.filter(t=>t.status==="PENDING").length > 0 && (
                <div style={{background:"rgba(245,166,35,.05)",border:"1px solid rgba(245,166,35,.2)",borderRadius:12,padding:"12px 14px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--amber)",marginBottom:10}}>⏳ {tenants.filter(t=>t.status==="PENDING").length} salons en attente de validation</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {tenants.filter(t=>t.status==="PENDING").slice(0,5).map(t => (
                      <div key={t.id} style={{background:"var(--card)",border:"1px solid var(--border2)",borderRadius:9,padding:"8px 12px",display:"flex",alignItems:"center",gap:9}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,fontWeight:600}}>{t.name}</div>
                          <div style={{fontSize:10,color:"var(--text3)"}}>{t.city} · {t.plan}</div>
                        </div>
                        <button type="button" onClick={() => tenantAction(t.id,"validate")} style={{padding:"4px 10px",borderRadius:7,border:"none",background:"rgba(34,211,138,.15)",color:"var(--g2)",fontSize:10,fontWeight:700,cursor:"pointer"}}>✓ Valider</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent audit activity */}
              {logs.length > 0 && (
                <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:"10px 14px",borderBottom:"1px solid var(--border)",fontSize:12,fontWeight:700}}>📋 Activité récente</div>
                  {logs.slice(0,6).map((l,i) => (
                    <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",borderBottom:i<5?"1px solid rgba(255,255,255,.03)":"none",fontSize:11}}>
                      <span style={{color:"var(--text3)",fontFamily:"monospace",fontSize:10,minWidth:55}}>{l.action}</span>
                      <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.tenant?.name ?? l.entityId.slice(0,12)}</span>
                      <span style={{color:"var(--text3)",fontSize:9}}>{l.actor?.name ?? "—"}</span>
                      <span style={{color:"var(--text3)",fontSize:9}}>{new Date(l.createdAt).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</span>
                    </div>
                  ))}
                </div>
              )}
              {logs.length === 0 && (
                <button type="button" onClick={() => { setView(5); loadLogs(1); }} style={{padding:"8px 14px",borderRadius:8,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:12,cursor:"pointer",width:"fit-content"}}>
                  📋 Charger les logs →
                </button>
              )}
            </>
          )}

          {/* ═══ VIEW 1 — TENANTS ═══ */}
          {view === 1 && (
            <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"11px 14px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontFamily:"var(--serif)",fontWeight:700,fontSize:12}}>Tous les salons</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, ville…" style={{width:180,fontSize:11,padding:"5px 10px",borderRadius:7,border:"1px solid var(--border2)",background:"var(--bg2)",color:"var(--text)"}} />
                <span style={{fontSize:10,color:"var(--text3)",marginLeft:"auto"}}>{filteredTenants.length} résultats</span>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead style={{background:"rgba(255,255,255,.02)"}}>
                    <tr>
                      {["Salon","Plan","Statut","Bookings","Actions"].map(h=>(
                        <th key={h} style={{padding:"8px 11px",textAlign:"left",fontSize:9,fontWeight:700,color:"var(--text3)",letterSpacing:".08em",textTransform:"uppercase"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan={5} style={{padding:"20px",textAlign:"center",color:"var(--text3)",fontSize:12}}>Chargement…</td></tr>}
                    {!loading && filteredTenants.length === 0 && <tr><td colSpan={5} style={{padding:"20px",textAlign:"center",color:"var(--text3)",fontSize:12}}>Aucun salon trouvé.</td></tr>}
                    {filteredTenants.map(t => {
                      const [sbg,sc] = STATUS_COLOR[t.status] ?? STATUS_COLOR.ACTIVE;
                      return (
                        <tr key={t.id} style={{borderTop:"1px solid rgba(255,255,255,.03)"}}>
                          <td style={{padding:"9px 11px"}}>
                            <div style={{fontWeight:600,fontSize:12}}>{t.name}</div>
                            <div style={{fontSize:9,color:"var(--text3)"}}>{t.city ?? "—"} · {t.users?.[0]?.phone ?? "—"}</div>
                          </td>
                          <td style={{padding:"9px 11px"}}>
                            <span style={{fontSize:9,fontWeight:700,color:PLAN_COLOR[t.plan]}}>{t.plan}</span>
                          </td>
                          <td style={{padding:"9px 11px"}}>
                            <Pill label={t.status} bg={sbg} color={sc} />
                          </td>
                          <td style={{padding:"9px 11px",fontSize:11}}>{t.bookingsUsedMonth}</td>
                          <td style={{padding:"9px 11px"}}>
                            <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                              {t.status==="PENDING" && <button type="button" onClick={()=>tenantAction(t.id,"validate")} style={{padding:"3px 8px",borderRadius:5,border:"none",fontSize:9,fontWeight:600,cursor:"pointer",background:"rgba(34,211,138,.12)",color:"var(--g2)"}}>Valider</button>}
                              {t.status==="ACTIVE"  && <button type="button" onClick={()=>tenantAction(t.id,"block")} style={{padding:"3px 8px",borderRadius:5,border:"none",fontSize:9,fontWeight:600,cursor:"pointer",background:"rgba(239,68,68,.1)",color:"var(--red)"}}>Bloquer</button>}
                              {(t.status==="BLOCKED"||t.status==="SUSPENDED") && <button type="button" onClick={()=>tenantAction(t.id,"reactivate")} style={{padding:"3px 8px",borderRadius:5,border:"none",fontSize:9,fontWeight:600,cursor:"pointer",background:"rgba(34,211,138,.1)",color:"var(--g2)"}}>Réactiver</button>}
                              {["FREE","PRO","PREMIUM"].filter(p=>p!==t.plan).map(p=>(
                                <button key={p} type="button" onClick={()=>tenantAction(t.id,"change_plan",{newPlan:p})} style={{padding:"3px 8px",borderRadius:5,border:"1px solid var(--border2)",fontSize:9,fontWeight:600,cursor:"pointer",background:"transparent",color:"var(--text3)"}}>→ {p}</button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ VIEW 2 — PLANS ═══ */}
          {view === 2 && (
            <>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:4}}>
                {(["FREE","PRO","PREMIUM"] as const).map(p => (
                  <div key={p} style={{background:"var(--card)",border:"1px solid var(--border2)",borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>{p}</div>
                    <div style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:800,color:PLAN_COLOR[p]}}>{planStats[p] ?? "—"}</div>
                    <div style={{fontSize:9,color:"var(--text3)"}}>salons</div>
                  </div>
                ))}
              </div>
              {plans.map(cfg => {
                const isEditing = editPlan === cfg.plan;
                const lim = cfg.limits ?? {};
                const feat = cfg.features ?? {};
                return (
                  <div key={cfg.plan} style={{background:"var(--card)",borderRadius:14,padding:18,border:"1px solid var(--border)",marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <div>
                        <span style={{fontWeight:700,fontSize:16,color:PLAN_COLOR[cfg.plan]}}>{cfg.plan}</span>
                        <span style={{marginLeft:10,fontSize:12,color:"var(--text3)"}}>{planStats[cfg.plan] ?? 0} salons</span>
                      </div>
                      {!isEditing ? (
                        <button type="button" onClick={()=>{setEditPlan(cfg.plan);setEditVals({priceFcfa:cfg.priceFcfa,priceEur:cfg.priceEur,priceFcfaAnnual:cfg.priceFcfaAnnual,limits:{...lim},features:{...feat}});}} style={{fontSize:11,padding:"5px 12px",borderRadius:7,background:"var(--card2)",border:"1px solid var(--border2)",color:"var(--text2)",cursor:"pointer"}}>✏️ Modifier</button>
                      ) : (
                        <div style={{display:"flex",gap:8}}>
                          <button type="button" onClick={()=>setEditPlan(null)} style={{fontSize:11,padding:"5px 12px",borderRadius:7,background:"transparent",border:"1px solid var(--border2)",color:"var(--text3)",cursor:"pointer"}}>Annuler</button>
                          <button type="button" onClick={savePlan} disabled={savingPlan} style={{fontSize:11,padding:"5px 12px",borderRadius:7,background:"var(--g2)",border:"none",color:"#000",fontWeight:700,cursor:"pointer"}}>{savingPlan?"…":"Sauvegarder"}</button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>
                        {[["Prix mensuel FCFA","priceFcfa"],["Prix mensuel EUR","priceEur"],["Prix annuel FCFA","priceFcfaAnnual"]].map(([label,key])=>(
                          <div key={key}>
                            <div style={{fontSize:10,color:"var(--text3)",marginBottom:4}}>{label}</div>
                            <input type="number" value={editVals[key]??0} onChange={e=>setEditVals((v:any)=>({...v,[key]:parseInt(e.target.value)||0}))} style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid var(--border2)",background:"var(--bg2)",color:"var(--text)",fontSize:13}} title={label} />
                          </div>
                        ))}
                        <div>
                          <div style={{fontSize:10,color:"var(--text3)",marginBottom:4}}>Bookings / mois (null = illimité)</div>
                          <input type="number" value={editVals.limits?.bookingsPerMonth??0} onChange={e=>setEditVals((v:any)=>({...v,limits:{...(v.limits??{}),bookingsPerMonth:parseInt(e.target.value)||0}}))} style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid var(--border2)",background:"var(--bg2)",color:"var(--text)",fontSize:13}} title="Bookings/mois" />
                        </div>
                        <div>
                          <div style={{fontSize:10,color:"var(--text3)",marginBottom:4}}>Services max</div>
                          <input type="number" value={editVals.limits?.services??0} onChange={e=>setEditVals((v:any)=>({...v,limits:{...(v.limits??{}),services:parseInt(e.target.value)||0}}))} style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid var(--border2)",background:"var(--bg2)",color:"var(--text)",fontSize:13}} title="Services max" />
                        </div>
                        <div style={{gridColumn:"1/-1"}}>
                          <div style={{fontSize:10,color:"var(--text3)",marginBottom:8}}>Features</div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                            {["deposit","whatsapp","analytics","prioritySupport","customDomain"].map(f=>(
                              <label key={f} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,cursor:"pointer"}}>
                                <input type="checkbox" checked={!!editVals.features?.[f]} onChange={e=>setEditVals((v:any)=>({...v,features:{...(v.features??{}),[f]:e.target.checked}}))} />
                                {f}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                        {[["Mensuel",cfg.priceFcfa.toLocaleString("fr")+" FCFA"],["EUR",cfg.priceEur+" €"],["Annuel",cfg.priceFcfaAnnual.toLocaleString("fr")+" FCFA"]].map(([l,v])=>(
                          <div key={l} style={{background:"var(--bg2)",borderRadius:8,padding:"8px 10px"}}>
                            <div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>{l}</div>
                            <div style={{fontSize:13,fontWeight:600}}>{v}</div>
                          </div>
                        ))}
                        <div style={{background:"var(--bg2)",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>Bookings/mois</div>
                          <div style={{fontSize:13,fontWeight:600}}>{lim.bookingsPerMonth ?? "∞"}</div>
                        </div>
                        <div style={{background:"var(--bg2)",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>Services</div>
                          <div style={{fontSize:13,fontWeight:600}}>{lim.services ?? "∞"}</div>
                        </div>
                        <div style={{background:"var(--bg2)",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"var(--text3)",marginBottom:4}}>Features</div>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            {["deposit","whatsapp","analytics","prioritySupport","customDomain"].filter(f=>feat[f]).map(f=>(
                              <span key={f} style={{fontSize:8,padding:"1px 5px",borderRadius:99,background:"rgba(34,211,138,.12)",color:"var(--g2)"}}>{f}</span>
                            ))}
                            {Object.values(feat).every(v=>!v) && <span style={{fontSize:10,color:"var(--text3)"}}>—</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {plans.length === 0 && <div style={{textAlign:"center",padding:"40px 0",color:"var(--text3)",fontSize:13}}>Chargement des plans…</div>}
            </>
          )}

          {/* ═══ VIEW 3 — FRAUDE ═══ */}
          {view === 3 && (
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <h2 style={{fontFamily:"var(--serif)",fontSize:15,fontWeight:700,flex:1}}>Alertes Fraude</h2>
                <button type="button" onClick={loadFraud} style={{padding:"6px 12px",borderRadius:7,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:11,cursor:"pointer"}}>↻</button>
              </div>
              {fraudLoading && <div style={{textAlign:"center",padding:"40px",color:"var(--text3)",fontSize:13}}>Chargement…</div>}
              {!fraudLoading && fraudList.length === 0 && (
                <div style={{textAlign:"center",padding:"48px",background:"var(--card)",border:"1px solid var(--border)",borderRadius:12}}>
                  <div style={{fontSize:36,marginBottom:12}}>🛡️</div>
                  <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>Aucune alerte fraude</div>
                  <div style={{fontSize:12,color:"var(--text3)"}}>La plateforme est saine.</div>
                </div>
              )}
              {fraudList.map(f => {
                const [fbg,fc] = FRAUD_COLOR[f.status] ?? FRAUD_COLOR.NEW;
                return (
                  <div key={f.id} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:"14px 16px",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          <span style={{fontWeight:700,fontSize:13}}>{f.tenant.name}</span>
                          <Pill label={f.status} bg={fbg} color={fc} />
                          <span style={{marginLeft:"auto",fontSize:11,fontWeight:700,color:f.riskScore>70?"var(--red)":f.riskScore>40?"var(--amber)":"var(--text3)"}}>Score {f.riskScore}/100</span>
                        </div>
                        <div style={{fontSize:10,color:"var(--text3)",marginBottom:8}}>Plan {f.tenant.plan} · {new Date(f.createdAt).toLocaleDateString("fr-FR")}</div>
                        {Array.isArray(f.signals) && f.signals.length > 0 && (
                          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
                            {(f.signals as any[]).map((s:any,i:number) => (
                              <span key={i} style={{fontSize:9,padding:"2px 7px",borderRadius:99,background:"rgba(239,68,68,.1)",color:"var(--red)"}}>{s.type ?? s}</span>
                            ))}
                          </div>
                        )}
                        {f.notes && <div style={{fontSize:11,color:"var(--text2)",fontStyle:"italic"}}>Note : {f.notes}</div>}
                      </div>
                      {f.status !== "CLOSED" && (
                        <div style={{display:"flex",gap:4,flexShrink:0}}>
                          {f.status==="NEW" && <button type="button" onClick={()=>fraudAction(f.id,"UNDER_REVIEW")} style={{padding:"4px 10px",borderRadius:7,border:"none",fontSize:10,fontWeight:600,cursor:"pointer",background:"rgba(59,126,246,.12)",color:"var(--blue)"}}>Enquêter</button>}
                          <button type="button" onClick={()=>fraudAction(f.id,"ACTION_TAKEN")} style={{padding:"4px 10px",borderRadius:7,border:"none",fontSize:10,fontWeight:600,cursor:"pointer",background:"rgba(239,68,68,.12)",color:"var(--red)"}}>Action</button>
                          <button type="button" onClick={()=>fraudAction(f.id,"CLOSED")} style={{padding:"4px 10px",borderRadius:7,border:"1px solid var(--border2)",fontSize:10,fontWeight:600,cursor:"pointer",background:"transparent",color:"var(--text3)"}}>Clore</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ VIEW 4 — ÉQUIPE ═══ */}
          {view === 4 && (
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <h2 style={{fontFamily:"var(--serif)",fontSize:15,fontWeight:700,flex:1}}>Équipe Belo</h2>
                <button type="button" onClick={loadTeam} style={{padding:"6px 12px",borderRadius:7,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:11,cursor:"pointer"}}>↻</button>
              </div>
              {teamLoading && <div style={{textAlign:"center",padding:"40px",color:"var(--text3)",fontSize:13}}>Chargement…</div>}
              <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
                {team.length === 0 && !teamLoading && (
                  <div style={{padding:"40px",textAlign:"center",color:"var(--text3)",fontSize:13}}>Aucun membre d'équipe.</div>
                )}
                {team.map((m,i) => (
                  <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:i<team.length-1?"1px solid rgba(255,255,255,.04)":"none"}}>
                    <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#e24b4a,#800)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0}}>
                      {m.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,marginBottom:1}}>{m.name}</div>
                      <div style={{fontSize:10,color:"var(--text3)"}}>{m.phone} {m.email ? `· ${m.email}` : ""}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:11,fontWeight:700,color:m.role==="SUPER_ADMIN"?"#e24b4a":"var(--amber)"}}>{m.role}</div>
                      <div style={{fontSize:9,color:"var(--text3)"}}>{m.lastLoginAt ? `Dernière connexion ${new Date(m.lastLoginAt).toLocaleDateString("fr-FR")}` : "Jamais connecté"}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:14,padding:"12px 14px",background:"rgba(245,166,35,.05)",border:"1px solid rgba(245,166,35,.15)",borderRadius:10,fontSize:11,color:"var(--amber)"}}>
                ⚠️ Les changements de rôle admin sont réservés au SUPER_ADMIN et tracés dans les logs.
              </div>
            </div>
          )}

          {/* ═══ VIEW 5 — LOGS ═══ */}
          {view === 5 && (
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <h2 style={{fontFamily:"var(--serif)",fontSize:15,fontWeight:700,flex:1}}>Audit Logs <span style={{fontSize:11,color:"var(--text3)",fontWeight:400}}>({logsTotal.toLocaleString()} total)</span></h2>
                <button type="button" onClick={()=>loadLogs(1)} style={{padding:"6px 12px",borderRadius:7,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:11,cursor:"pointer"}}>↻</button>
              </div>
              {logsLoading && <div style={{textAlign:"center",padding:"40px",color:"var(--text3)",fontSize:13}}>Chargement…</div>}
              <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
                {logs.length === 0 && !logsLoading && <div style={{padding:"40px",textAlign:"center",color:"var(--text3)",fontSize:13}}>Aucun log.</div>}
                {logs.map((l,i) => (
                  <div key={l.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"9px 14px",borderBottom:i<logs.length-1?"1px solid rgba(255,255,255,.03)":"none",fontSize:11}}>
                    <div style={{fontFamily:"monospace",fontSize:10,color:l.action.includes("block")||l.action.includes("fraud")?"var(--red)":l.action.includes("valid")?"var(--g2)":"var(--text3)",whiteSpace:"nowrap",minWidth:130}}>{l.action}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <span style={{color:"var(--text)"}}>{l.tenant?.name ?? l.entityId.slice(0,16)}</span>
                      {l.actor && <span style={{color:"var(--text3)",marginLeft:8}}>par {l.actor.name}</span>}
                    </div>
                    <div style={{fontSize:9,color:"var(--text3)",whiteSpace:"nowrap"}}>{new Date(l.createdAt).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
                  </div>
                ))}
              </div>
              {logsTotal > 40 && (
                <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:12}}>
                  <button type="button" disabled={logsPage===1} onClick={()=>loadLogs(logsPage-1)} style={{padding:"6px 14px",borderRadius:7,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:11,cursor:logsPage===1?"not-allowed":"pointer",opacity:logsPage===1?.4:1}}>← Précédent</button>
                  <span style={{padding:"6px 14px",fontSize:11,color:"var(--text3)"}}>Page {logsPage} / {Math.ceil(logsTotal/40)}</span>
                  <button type="button" disabled={logsPage*40>=logsTotal} onClick={()=>loadLogs(logsPage+1)} style={{padding:"6px 14px",borderRadius:7,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:11,cursor:logsPage*40>=logsTotal?"not-allowed":"pointer",opacity:logsPage*40>=logsTotal?.4:1}}>Suivant →</button>
                </div>
              )}
            </div>
          )}

          {/* ═══ VIEW 6 — RÉGLAGES ═══ */}
          {view === 6 && (
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                <h2 style={{fontFamily:"var(--serif)",fontSize:15,fontWeight:700,flex:1}}>Paramètres système</h2>
                <button type="button" onClick={saveSettings} disabled={savingSettings} style={{padding:"7px 16px",borderRadius:9,border:"none",background:"var(--g)",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  {savingSettings ? "Sauvegarde…" : "💾 Sauvegarder"}
                </button>
              </div>
              {settingsLoading && <div style={{textAlign:"center",padding:"40px",color:"var(--text3)",fontSize:13}}>Chargement…</div>}
              {!settingsLoading && (
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {/* Maintenance mode */}
                  <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:"16px 18px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,marginBottom:3}}>🔒 Mode maintenance</div>
                        <div style={{fontSize:11,color:"var(--text3)"}}>Désactive toutes les réservations sur la plateforme.</div>
                      </div>
                      <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                        <input type="checkbox" checked={!!settingsDraft.maintenance_mode} onChange={e=>setSettingsDraft(s=>({...s,maintenance_mode:e.target.checked}))} style={{width:16,height:16,accentColor:"var(--red)"}} />
                        <span style={{fontSize:12,color:settingsDraft.maintenance_mode?"var(--red)":"var(--text3)"}}>{settingsDraft.maintenance_mode?"ACTIVÉ":"Désactivé"}</span>
                      </label>
                    </div>
                  </div>

                  {/* Commission */}
                  <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:"16px 18px"}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:3}}>💰 Commission plateforme (%)</div>
                    <div style={{fontSize:11,color:"var(--text3)",marginBottom:12}}>Prélevée sur chaque transaction.</div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <input type="range" min={0} max={20} step={0.5} value={Number(settingsDraft.commission_percent ?? 3)} onChange={e=>setSettingsDraft(s=>({...s,commission_percent:parseFloat(e.target.value)}))} style={{flex:1,accentColor:"var(--g2)"}} />
                      <span style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:800,color:"var(--g2)",minWidth:40}}>{settingsDraft.commission_percent ?? 3}%</span>
                    </div>
                  </div>

                  {/* Providers actifs */}
                  <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:"16px 18px"}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:3}}>💳 Providers de paiement actifs</div>
                    <div style={{fontSize:11,color:"var(--text3)",marginBottom:12}}>Les providers désactivés ne seront pas proposés aux gérants.</div>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                      {["WAVE","ORANGE_MONEY","STRIPE","PAYSTACK","MTN_MONEY","CASH"].map(p=>{
                        const active = Array.isArray(settingsDraft.active_providers) && settingsDraft.active_providers.includes(p);
                        return (
                          <label key={p} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"6px 12px",borderRadius:8,border:`1px solid ${active?"rgba(34,211,138,.3)":"var(--border2)"}`,background:active?"rgba(34,211,138,.06)":"transparent",fontSize:11,fontWeight:600,color:active?"var(--g2)":"var(--text3)"}}>
                            <input type="checkbox" checked={active} onChange={e=>{
                              const curr = Array.isArray(settingsDraft.active_providers) ? settingsDraft.active_providers : [];
                              setSettingsDraft(s=>({...s,active_providers:e.target.checked?[...curr,p]:curr.filter((x:string)=>x!==p)}));
                            }} style={{width:12,height:12,accentColor:"var(--g2)"}} />
                            {p}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* OTP Bypass */}
                  <div style={{background:"rgba(245,166,35,.04)",border:"1px solid rgba(245,166,35,.2)",borderRadius:12,padding:"16px 18px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,marginBottom:3}}>🔐 OTP Bypass (DEV ONLY)</div>
                        <div style={{fontSize:11,color:"var(--amber)"}}>⚠️ Désactive l'envoi WhatsApp — OTP affiché dans les logs serveur.</div>
                      </div>
                      <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                        <input type="checkbox" checked={!!settingsDraft.otp_bypass} onChange={e=>setSettingsDraft(s=>({...s,otp_bypass:e.target.checked}))} style={{width:16,height:16,accentColor:"var(--amber)"}} />
                        <span style={{fontSize:12,color:settingsDraft.otp_bypass?"var(--amber)":"var(--text3)"}}>{settingsDraft.otp_bypass?"ON":"OFF"}</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Toasts */}
      <div style={{position:"fixed",bottom:20,right:20,zIndex:1000,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
        {toasts.map(t => (
          <div key={t.id} style={{background:"var(--card)",border:`1px solid ${t.ok===false?"rgba(239,68,68,.3)":"rgba(34,211,138,.3)"}`,borderRadius:12,padding:"10px 16px",fontSize:13,minWidth:220,boxShadow:"0 8px 24px rgba(0,0,0,.5)",pointerEvents:"all",color:"var(--text)"}}>
            {t.msg}
          </div>
        ))}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}`}</style>
    </div>
  );
}
