"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const TENANTS = [
  { name:"Studio Élégance", loc:"Plateau · Dakar",  plan:"PREMIUM", status:"active",  revenue:"847 200", bookings:312, health:92, mrrContrib:"35 000" },
  { name:"Zen Massage",     loc:"Almadies · Dakar", plan:"PREMIUM", status:"active",  revenue:"1 340 000",bookings:267, health:88, mrrContrib:"35 000" },
  { name:"Golden Touch",    loc:"Point-E · Dakar",  plan:"PRO",     status:"fraud",   revenue:"2 100 000",bookings:341, health:12, mrrContrib:"15 000" },
  { name:"Bella Coiffure",  loc:"Mermoz · Dakar",   plan:"FREE",    status:"pending", revenue:"96 000",   bookings:12,  health:51, mrrContrib:"0" },
  { name:"Espace Sérénité", loc:"Fann · Dakar",     plan:"PRO",     status:"blocked", revenue:"—",        bookings:0,   health:8,  mrrContrib:"0" },
  { name:"Luxe Beauty",     loc:"Ouakam · Dakar",   plan:"PREMIUM", status:"active",  revenue:"546 000",  bookings:178, health:84, mrrContrib:"35 000" },
];

const VIEWS = ["Mission Control","Tenants","Plans","Fraude","Équipe","Logs","Réglages"];

export default function AdminPage() {
  const [view, setView] = useState(0);
  const [toasts, setToasts] = useState<{id:number;msg:string}[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/tenants")
      .then(r => r.json())
      .then(d => { if (d.data?.tenants) setTenants(d.data.tenants); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toast(msg: string) {
    const id = Date.now();
    setToasts(t => [...t, {id,msg}]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800);
  }

  const statusBadge = (s:string) => {
    const c: Record<string, [string,string]> = { active:["rgba(34,211,138,.1)","var(--g2)"], pending:["rgba(245,166,35,.1)","var(--amber)"], blocked:["rgba(239,68,68,.1)","var(--red)"], fraud:["rgba(239,68,68,.18)","var(--red)"] };
    const [bg,color] = c[s] ?? c.active;
    return <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:99,background:bg,color}}>{s.toUpperCase()}</span>;
  };

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
      {/* Sidebar */}
      <aside style={{width:240,background:"#070b10",borderRight:"1px solid rgba(30,40,55,.8)",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"16px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid var(--border)"}}>
          <div style={{width:30,height:30,background:"linear-gradient(135deg,var(--red),#800)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⚡</div>
          <div>
            <div style={{fontFamily:"var(--serif)",fontWeight:800,fontSize:15}}>belo<span style={{color:"var(--red)"}}>.</span></div>
            <div style={{fontSize:9,color:"var(--red)",letterSpacing:".06em"}}>Super Admin</div>
          </div>
        </div>
        <div style={{margin:"10px 12px 0",padding:"4px 10px",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",borderRadius:8,fontSize:9,fontWeight:700,color:"var(--red)",letterSpacing:".08em",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          <span style={{width:5,height:5,borderRadius:"50%",background:"var(--g2)",animation:"pulse 2s infinite"}} />
          Système opérationnel · Live
        </div>
        <nav style={{padding:"8px 0",flex:1}}>
          {[["▦","Mission Control",0],["🏢","Tenants",1],["💳","Plans",2],["🛡️","Fraude",3],["👥","Équipe",4],["📋","Logs",5],["⚙️","Réglages",6]].map(([icon,label,idx]) => (
            <div key={label as string} onClick={() => setView(idx as number)} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 16px",fontSize:12,color:view===idx?"var(--g2)":"var(--text3)",background:view===idx?"rgba(34,211,138,.1)":"transparent",cursor:"pointer",transition:".15s",borderLeft:view===idx?"3px solid var(--g2)":"3px solid transparent",marginBottom:1}}>
              <span style={{fontSize:13,width:17,textAlign:"center"}}>{icon}</span>{label}
            </div>
          ))}
        </nav>
        <div style={{padding:"10px 8px",borderTop:"1px solid var(--border)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,var(--red),#800)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800}}>P</div>
            <div><div style={{fontSize:11,fontWeight:600}}>Pape Diouf</div><div style={{fontSize:9,color:"var(--red)"}}>SUPER ADMIN</div></div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Topbar */}
        <div style={{padding:"10px 20px",borderBottom:"1px solid var(--border)",background:"var(--card2)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div>
            <div style={{fontFamily:"var(--serif)",fontWeight:700,fontSize:14}}>{VIEWS[view]}</div>
            <div style={{fontSize:10,color:"var(--text3)"}}>Belo Admin · {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"var(--g2)",background:"rgba(34,211,138,.07)",border:"1px solid rgba(34,211,138,.15)",padding:"3px 10px",borderRadius:99}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:"var(--g2)",animation:"pulse 1.5s infinite"}} />
              Live · 8s
            </div>
            <button onClick={() => toast("↓ Export CSV généré")} style={{padding:"6px 12px",borderRadius:7,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:11,fontWeight:600,cursor:"pointer"}}>↓ CSV</button>
            <button onClick={() => toast("🔒 Mode maintenance activé")} style={{padding:"6px 12px",borderRadius:7,background:"rgba(239,68,68,.12)",color:"var(--red)",border:"none",fontSize:11,fontWeight:600,cursor:"pointer"}}>🔒 Maintenance</button>
            <button onClick={() => toast("✅ Nouveau salon créé")} style={{padding:"6px 12px",borderRadius:7,background:"var(--g)",color:"#fff",border:"none",fontSize:11,fontWeight:600,cursor:"pointer"}}>+ Salon</button>
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>

          {/* MISSION CONTROL */}
          {view === 0 && (
            <>
              <div style={{background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.18)",borderRadius:12,padding:"12px 14px"}}>
                <div style={{fontFamily:"var(--serif)",fontWeight:700,fontSize:11,color:"var(--red)",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>⚡ Actions critiques requises</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}>
                  {[
                    { icon:"🚨", title:"Suspendre Golden Touch Nails", sub:"Score fraude 87% · 48 annulations/24h · 17 IPs suspectes", impact:"Impact : -2.1% fraude plateforme", impactColor:"var(--red)", btn1:"🚫 Suspendre", btn2:"Enquêter" },
                    { icon:"⬆️", title:"8 salons FREE à 90%+ quota", sub:"Opportunité conversion Pro → +200k F MRR potentiel", impact:"Impact : +200 000 F MRR estimé", impactColor:"var(--g2)", btn1:"Envoyer offre", btn2:"Voir liste" },
                    { icon:"⏳", title:"12 salons en attente validation", sub:"Attente moy. 48h · 3 en attente depuis +72h", impact:"Impact : +12 tenants actifs potentiels", impactColor:"var(--amber)", btn1:"Valider en masse", btn2:"Voir dossiers" },
                  ].map(a => (
                    <div key={a.title} style={{background:"rgba(255,255,255,.025)",border:"1px solid var(--border2)",borderRadius:10,padding:11,cursor:"pointer",transition:".15s"}}>
                      <div style={{fontSize:18,marginBottom:6}}>{a.icon}</div>
                      <div style={{fontSize:11,fontWeight:700,marginBottom:3}}>{a.title}</div>
                      <div style={{fontSize:10,color:"var(--text3)",lineHeight:1.4,marginBottom:7}}>{a.sub}</div>
                      <div style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:99,display:"inline-block",marginBottom:7,background:a.impactColor==="var(--red)"?"rgba(239,68,68,.15)":a.impactColor==="var(--g2)"?"rgba(34,211,138,.1)":"rgba(245,166,35,.12)",color:a.impactColor}}>{a.impact}</div>
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={() => toast(`✅ ${a.btn1} effectué`)} style={{padding:"4px 9px",borderRadius:6,border:"none",fontSize:9,fontWeight:600,cursor:"pointer",background:a.impactColor==="var(--red)"?"rgba(239,68,68,.15)":"rgba(34,211,138,.12)",color:a.impactColor==="var(--red)"?"var(--red)":"var(--g2)"}}>{a.btn1}</button>
                        <button onClick={() => setView(1)} style={{padding:"4px 9px",borderRadius:6,border:"none",fontSize:9,fontWeight:600,cursor:"pointer",background:"rgba(255,255,255,.06)",color:"var(--text3)"}}>{a.btn2}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
                {[
                  { lbl:"MRR Plateforme", val:"32.4M", delta:"↑ +8.2%", color:"var(--g2)" },
                  { lbl:"Bookings (30j)",  val:"14.2k", delta:"↑ +18%",   color:"var(--amber)" },
                  { lbl:"Churn Rate",      val:"3.2%",  delta:"↑ +0.4% ⚠",color:"var(--red)" },
                  { lbl:"ARPU moyen",      val:"95k F", delta:"↑ +12%",   color:"var(--text)" },
                  { lbl:"Tenants actifs",  val:"340",   delta:"↑ +12 ce mois",color:"var(--blue)" },
                ].map(k => (
                  <div key={k.lbl} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:11,padding:13}}>
                    <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:7}}>{k.lbl}</div>
                    <div style={{fontFamily:"var(--serif)",fontSize:22,fontWeight:800,lineHeight:1,marginBottom:4,color:k.color}}>{k.val}</div>
                    <div style={{fontSize:10,color:"var(--g2)"}}>{k.delta}</div>
                  </div>
                ))}
              </div>

              <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"11px 14px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <span style={{fontFamily:"var(--serif)",fontWeight:700,fontSize:12}}>Activité live</span>
                    <span style={{width:5,height:5,borderRadius:"50%",background:"var(--g2)",animation:"pulse 1.5s infinite"}} />
                  </div>
                </div>
                {[
                  { icon:"📅", color:"rgba(34,211,138,.1)", title:"Nouvelle réservation · Studio Élégance", sub:"Aminata D. · Pose ongles · 12 000 F · Wave", time:"32s" },
                  { icon:"🏢", color:"rgba(59,126,246,.1)",  title:"Nouveau salon — validation requise", sub:"Nails Paradise · Thiès · Plan Free", time:"1min" },
                  { icon:"💳", color:"rgba(34,211,138,.1)", title:"Paiement confirmé · Wave", sub:"Zen Massage · 15 000 F · Commission 450 F", time:"2min" },
                  { icon:"🛡️", color:"rgba(239,68,68,.1)",  title:"🚨 Alerte fraude auto-déclenchée", sub:"Golden Touch · 48 annulations · Score ML 87%", time:"4min" },
                  { icon:"⬆", color:"rgba(245,166,35,.1)",  title:"Upgrade plan · Luxe Beauty", sub:"Free → Premium · 35 000 F/mois · MRR +35 000 F", time:"8min" },
                ].map((f,i) => (
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"9px 14px",borderBottom:i<4?"1px solid rgba(255,255,255,.02)":"none",cursor:"pointer"}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:f.color,border:`1px solid ${f.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0,marginTop:1}}>{f.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:600,marginBottom:2}}>{f.title}</div>
                      <div style={{fontSize:10,color:"var(--text3)"}}>{f.sub}</div>
                    </div>
                    <div style={{fontSize:9,color:"var(--text3)",whiteSpace:"nowrap",flexShrink:0}}>{f.time}</div>
                    <button onClick={() => toast("Ouverture…")} style={{padding:"3px 9px",borderRadius:6,border:"1px solid var(--border2)",background:"none",fontSize:10,fontWeight:600,cursor:"pointer",color:"var(--text3)",whiteSpace:"nowrap"}}>Ouvrir →</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* TENANTS TABLE */}
          {view === 1 && (
            <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"11px 14px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontFamily:"var(--serif)",fontWeight:700,fontSize:12}}>Tous les salons</span>
                <input placeholder="Nom, ville, email…" style={{width:170,fontSize:11,padding:"6px 10px"}} />
                {["Tous (340)","✅ Actifs","⏳ Attente","🚫 Bloqués","⚠️ Fraude"].map(f => (
                  <button key={f} style={{padding:"4px 10px",borderRadius:6,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:10,cursor:"pointer"}}>{f}</button>
                ))}
                <div style={{marginLeft:"auto",display:"flex",gap:5}}>
                  <button onClick={() => toast("↓ CSV généré")} style={{padding:"6px 12px",borderRadius:7,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:10,fontWeight:600,cursor:"pointer"}}>↓ CSV</button>
                  <button onClick={() => toast("✅ Nouveau salon créé")} style={{padding:"6px 12px",borderRadius:7,background:"var(--g)",color:"#fff",border:"none",fontSize:10,fontWeight:600,cursor:"pointer"}}>+ Salon</button>
                </div>
              </div>
              <div style={{padding:"8px 14px",background:"rgba(34,211,138,.05)",borderBottom:"1px solid rgba(34,211,138,.12)",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,fontWeight:700,color:"var(--g2)"}}>3 salons sélectionnés</span>
                <div style={{display:"flex",gap:5,marginLeft:"auto"}}>
                  {[["🚫 Bloquer (3)","red"],["⬆ Upgrade","green"],["💬 Message","blue"],["↓ Exporter","ghost"]].map(([label,type]) => (
                    <button key={label} onClick={() => toast(`${label} effectué`)} style={{padding:"5px 10px",borderRadius:6,border:"none",fontSize:10,fontWeight:600,cursor:"pointer",background:type==="red"?"rgba(239,68,68,.15)":type==="green"?"rgba(34,211,138,.12)":type==="blue"?"rgba(59,126,246,.12)":"rgba(255,255,255,.07)",color:type==="red"?"var(--red)":type==="green"?"var(--g2)":type==="blue"?"var(--blue)":"var(--text3)"}}>{label}</button>
                  ))}
                </div>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead style={{background:"rgba(255,255,255,.02)"}}>
                  <tr>
                    {["","Salon","Plan","Statut","Revenue/mois","Bookings","Health","Changer plan","Actions"].map(h => (
                      <th key={h} style={{padding:"8px 11px",textAlign:"left",fontSize:9,fontWeight:700,color:"var(--text3)",letterSpacing:".08em",textTransform:"uppercase"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={9} style={{padding:"20px",textAlign:"center",fontSize:12,color:"var(--text3)"}}>Chargement…</td></tr>}
                  {!loading && tenants.length === 0 && <tr><td colSpan={9} style={{padding:"20px",textAlign:"center",fontSize:12,color:"var(--text3)"}}>Aucun salon trouvé.</td></tr>}
                  {tenants.map((t,i) => (
                    <tr key={i} style={{borderTop:"1px solid rgba(255,255,255,.03)",background:t.status==="fraud"?"rgba(239,68,68,.02)":"transparent",cursor:"pointer"}}>
                      <td style={{padding:"9px 11px"}}><input type="checkbox" aria-label={`Sélectionner ${t.name}`} style={{width:13,height:13,accentColor:"var(--g2)"}} /></td>
                      <td style={{padding:"9px 11px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#1b8a65,#0a5040)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"var(--serif)",fontWeight:800,color:"#fff",flexShrink:0}}>{t.name?.[0] ?? "?"}</div>
                          <div><div style={{fontSize:12,fontWeight:600}}>{t.name}</div><div style={{fontSize:9,color:"var(--text3)"}}>{t.city ?? "—"}</div></div>
                        </div>
                      </td>
                      <td style={{padding:"9px 11px"}}><span style={{padding:"2px 7px",borderRadius:5,fontSize:9,fontWeight:700,background:t.plan==="PREMIUM"?"rgba(34,211,138,.1)":t.plan==="PRO"?"rgba(59,126,246,.1)":"rgba(255,255,255,.06)",color:t.plan==="PREMIUM"?"var(--g2)":t.plan==="PRO"?"var(--blue)":"var(--text3)"}}>{t.plan ?? "FREE"}</span></td>
                      <td style={{padding:"9px 11px"}}>{statusBadge(t.status ?? "active")}</td>
                      <td style={{padding:"9px 11px",fontWeight:700,color:"var(--g2)",fontSize:12}}>{t.revenue ?? "—"}</td>
                      <td style={{padding:"9px 11px",fontSize:12}}>{t.bookingsThisMonth ?? 0}</td>
                      <td style={{padding:"9px 11px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <span style={{fontSize:11,fontWeight:700,color:"var(--text3)"}}>—</span>
                        </div>
                      </td>
                      <td style={{padding:"9px 11px"}}>
                        <div style={{display:"flex",gap:3}}>
                          {["FREE","PRO","PREM"].map(p => <button key={p} onClick={() => toast(`Plan → ${p}`)} style={{padding:"3px 8px",borderRadius:5,border:`1px solid ${p==="FREE"?"var(--border2)":p==="PRO"?"rgba(59,126,246,.3)":"rgba(144,96,232,.3)"}`,background:p==="FREE"?"transparent":p==="PRO"?"rgba(59,126,246,.06)":"rgba(144,96,232,.06)",color:p==="FREE"?"var(--text3)":p==="PRO"?"var(--blue)":"var(--purple)",fontSize:9,fontWeight:600,cursor:"pointer",transition:".15s"}}>{p}</button>)}
                        </div>
                      </td>
                      <td style={{padding:"9px 11px"}}>
                        <div style={{display:"flex",gap:3}}>
                          <button onClick={() => toast("Fiche salon ouverte")} style={{padding:"3px 8px",borderRadius:5,border:"none",fontSize:9,fontWeight:600,cursor:"pointer",background:"rgba(255,255,255,.06)",color:"var(--text3)"}}>Voir</button>
                          {t.status==="blocked" ? <button onClick={() => toast("✅ Réactivé")} style={{padding:"3px 8px",borderRadius:5,border:"none",fontSize:9,fontWeight:600,cursor:"pointer",background:"rgba(34,211,138,.1)",color:"var(--g2)"}}>Réactiver</button> : <button onClick={() => toast("🚫 Bloqué")} style={{padding:"3px 8px",borderRadius:5,border:"none",fontSize:9,fontWeight:600,cursor:"pointer",background:"rgba(239,68,68,.1)",color:"var(--red)"}}>Bloquer</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{padding:"10px 14px",borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:10,color:"var(--text3)"}}>
                <span>1–6 sur <strong>340</strong> · <span style={{color:"var(--amber)"}}>48 en attente</span> · <span style={{color:"var(--red)"}}>2 fraudes</span></span>
                <div style={{display:"flex",gap:3}}>
                  {["←","1","2","3","…","34","→"].map(p => <button key={p} style={{width:24,height:24,borderRadius:5,border:"1px solid var(--border)",background:p==="1"?"rgba(34,211,138,.1)":"transparent",color:p==="1"?"var(--g2)":"var(--text3)",fontSize:10,cursor:"pointer"}}>{p}</button>)}
                </div>
              </div>
            </div>
          )}

          {/* PLANS VIEW */}
          {view === 2 && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {[
                { name:"Free", color:"var(--text3)", tenants:160, mrr:"0", limits:[["Bookings/mois","20"],["Services max","1"],["Photos/service","1"],["WhatsApp auto","❌"],["Acompte","❌"]], prices:{fcfa:"0",eur:"0"} },
                { name:"Pro", color:"var(--blue)", tenants:93, mrr:"1 395 000", limits:[["Bookings/mois","500"],["Services max","20"],["Photos/service","10"],["WhatsApp auto","✅"],["Acompte","✅"]], prices:{fcfa:"15000",eur:"23"} },
                { name:"Premium", color:"var(--g2)", tenants:87, mrr:"3 045 000", limits:[["Bookings/mois","∞"],["Services max","∞"],["Photos/service","50"],["WhatsApp auto","✅"],["Multi-staff","✅"]], prices:{fcfa:"35000",eur:"53"} },
              ].map(p => (
                <div key={p.name} style={{background:"var(--card)",border:`1px solid ${p.color==="var(--g2)"?"rgba(34,211,138,.25)":p.color==="var(--blue)"?"rgba(59,126,246,.2)":"var(--border)"}`,borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:14,borderBottom:"1px solid var(--border)"}}>
                    <div style={{fontFamily:"var(--serif)",fontWeight:800,fontSize:16,color:p.color,marginBottom:4}}>{p.name}</div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>{p.tenants} salons · MRR {p.mrr} F</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:10}}>
                      <div style={{background:"rgba(255,255,255,.03)",borderRadius:7,padding:8,textAlign:"center"}}>
                        <div style={{fontFamily:"var(--serif)",fontSize:16,fontWeight:800,color:p.color}}>{p.tenants}</div>
                        <div style={{fontSize:9,color:"var(--text3)",marginTop:2}}>Tenants</div>
                      </div>
                      <div style={{background:"rgba(255,255,255,.03)",borderRadius:7,padding:8,textAlign:"center"}}>
                        <div style={{fontFamily:"var(--serif)",fontSize:14,fontWeight:800,color:p.color}}>{p.mrr.split(" ")[0]}k</div>
                        <div style={{fontSize:9,color:"var(--text3)",marginTop:2}}>MRR</div>
                      </div>
                    </div>
                  </div>
                  <div style={{padding:14}}>
                    <div style={{fontSize:10,fontWeight:700,color:"var(--text3)",letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>Limites</div>
                    {p.limits.map(([label,val]) => (
                      <div key={label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.04)",fontSize:11}}>
                        <span style={{color:"var(--text3)"}}>{label}</span>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <input defaultValue={val} disabled={val==="❌"||val==="✅"||val==="∞"} style={{width:60,textAlign:"right",fontSize:11,fontWeight:700,padding:"3px 7px",background:"rgba(255,255,255,.06)",border:"1px solid var(--border2)",borderRadius:5,color:"var(--text)"}} />
                          <button onClick={() => toast("✅ Limite mise à jour")} style={{padding:"3px 7px",borderRadius:5,border:"none",background:"rgba(34,211,138,.12)",color:"var(--g2)",fontSize:8,fontWeight:700,cursor:"pointer"}}>OK</button>
                        </div>
                      </div>
                    ))}
                    <div style={{fontSize:10,fontWeight:700,color:"var(--text3)",letterSpacing:".08em",textTransform:"uppercase",margin:"12px 0 8px"}}>Prix</div>
                    {[["🇸🇳","FCFA",p.prices.fcfa],["🇪🇺","EUR",p.prices.eur]].map(([flag,curr,val]) => (
                      <div key={curr as string} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,fontSize:11}}>
                        <span style={{width:16}}>{flag}</span>
                        <span style={{flex:1,color:"var(--text3)"}}>{curr}</span>
                        <input defaultValue={val as string} style={{width:80,textAlign:"right",fontSize:11,fontWeight:700,padding:"4px 8px",background:"rgba(255,255,255,.05)",border:"1px solid var(--border2)",borderRadius:6,color:"var(--text)"}} />
                      </div>
                    ))}
                    <button onClick={() => toast(`✅ Plan ${p.name} mis à jour`)} style={{width:"100%",padding:10,borderRadius:9,border:"none",background:"var(--g)",color:"#fff",fontFamily:"var(--serif)",fontWeight:700,fontSize:12,cursor:"pointer",marginTop:12}}>Enregistrer</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* OTHER VIEWS PLACEHOLDER */}
          {view > 2 && (
            <div style={{textAlign:"center",padding:"60px 0"}}>
              <div style={{fontSize:40,marginBottom:16}}>🔧</div>
              <div style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:700,marginBottom:8}}>{VIEWS[view]}</div>
              <p style={{color:"var(--text3)",fontSize:13}}>Vue disponible dans la version complète.</p>
            </div>
          )}
        </div>
      </div>

      {/* Toasts */}
      <div style={{position:"fixed",bottom:20,right:20,zIndex:1000,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
        {toasts.map(t => (
          <div key={t.id} style={{background:"var(--card)",border:"1px solid rgba(34,211,138,.3)",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,fontSize:13,minWidth:240,boxShadow:"0 8px 24px rgba(0,0,0,.4)",animation:"slideIn .3s ease",pointerEvents:"all",color:"var(--text)"}}>
            <span>✅</span><span style={{flex:1}}>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
