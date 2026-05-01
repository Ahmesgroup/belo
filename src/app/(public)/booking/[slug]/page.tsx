"use client";
import { useState } from "react";
import { PublicNav } from "@/components/ui/Nav";
import Link from "next/link";

const SERVICES = [
  { id:"s1", name:"Tresses africaines",    dur:"2h30", price:18000, icon:"🪢", dep:5400 },
  { id:"s2", name:"Coiffure femme",         dur:"1h",   price:9500,  icon:"💇‍♀️", dep:2850 },
  { id:"s3", name:"Coloration",             dur:"1h45", price:22000, icon:"🎨", dep:6600 },
  { id:"s4", name:"Manucure gel",           dur:"45min",price:7000,  icon:"💅", dep:2100 },
];
const DATES = [
  { day:"Mer", num:"30", avail:5 }, { day:"Jeu", num:"1",  avail:3 },
  { day:"Ven", num:"2",  avail:8 }, { day:"Sam", num:"3",  avail:2 },
  { day:"Lun", num:"5",  avail:6 }, { day:"Mar", num:"6",  avail:4 },
];
const SLOTS_AM = ["9:00","9:30","10:00","10:30","11:00","11:30"];
const SLOTS_PM = ["14:00","14:30","15:00","15:30","16:00","16:30"];
const SLOTS_EVE= ["17:00","17:30","18:00","18:30","19:00"];

export default function BookingPage({ params }: { params: { slug: string } }) {
  const [step, setStep] = useState(1);
  const [svc, setSvc] = useState<typeof SERVICES[0] | null>(null);
  const [slot, setSlot] = useState("");
  const [date, setDate] = useState("30");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [payMethod, setPayMethod] = useState("wave");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const goNext = () => setStep(s => Math.min(s+1, 4));
  const goPrev = () => setStep(s => Math.max(s-1, 1));

  async function confirmBooking() {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    setDone(true);
    setStep(4);
  }

  return (
    <>
      <PublicNav />
      <main style={{paddingTop:56}}>
        <div style={{maxWidth:760,margin:"0 auto",padding:"32px 20px 60px"}}>

          {/* Header */}
          <div style={{marginBottom:28}}>
            <Link href="/salons" style={{fontSize:12,color:"var(--text3)",textDecoration:"none",marginBottom:8,display:"block"}}>← Retour aux salons</Link>
            <h2 style={{fontFamily:"var(--serif)",fontSize:22,fontWeight:700,marginBottom:4}}>Salon Aminata Beauty</h2>
            <p style={{fontSize:13,color:"var(--text2)"}}>Almadies, Dakar · ★ 4.9 · Ouvert jusqu'à 20h</p>
          </div>

          {/* Step tabs */}
          <div style={{display:"flex",alignItems:"center",background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden",marginBottom:32}}>
            {[{n:1,l:"Service"},{n:2,l:"Créneau"},{n:3,l:"Confirmer"},{n:4,l:"✓ Réservé"}].map(({n,l}) => {
              const isDone = step > n;
              const isActive = step === n;
              return (
                <div key={n} onClick={() => n < step && setStep(n)} style={{flex:1,padding:"14px 12px",textAlign:"center",fontSize:11,fontWeight:600,color:isDone?"var(--g2)":isActive?"var(--text)":"var(--text3)",cursor:n < step ? "pointer" : "default",background:isDone?"rgba(34,211,138,.05)":isActive?"rgba(255,255,255,.04)":"transparent",borderRight:"1px solid var(--border)",transition:".2s",position:"relative"}}>
                  <div style={{width:20,height:20,borderRadius:"50%",background:isDone?"var(--g)":isActive?"var(--g2)":"var(--border2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,margin:"0 auto 4px",color:isDone||isActive?"#111":"var(--text3)"}}>
                    {isDone ? "✓" : n}
                  </div>
                  {l}
                </div>
              );
            })}
          </div>

          {/* STEP 1 — Service */}
          {step === 1 && (
            <div>
              <div style={{fontFamily:"var(--serif)",fontSize:15,fontWeight:700,marginBottom:14}}>Choisissez votre prestation</div>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
                {SERVICES.map(s => (
                  <div key={s.id} onClick={() => setSvc(s)} style={{background:svc?.id===s.id?"rgba(34,211,138,.04)":"var(--card)",border:`1px solid ${svc?.id===s.id?"rgba(34,211,138,.4)":"var(--border)"}`,borderRadius:16,padding:16,display:"flex",alignItems:"center",gap:14,cursor:"pointer",transition:".2s"}}>
                    <div style={{width:44,height:44,borderRadius:12,background:"rgba(34,211,138,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{s.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:14,marginBottom:2}}>{s.name}</div>
                      <div style={{fontSize:11,color:"var(--text3)"}}>⏱ {s.dur}</div>
                    </div>
                    <div style={{fontFamily:"var(--serif)",fontSize:16,fontWeight:700,color:"var(--g2)",whiteSpace:"nowrap"}}>{s.price.toLocaleString("fr")} F</div>
                    <div style={{width:20,height:20,borderRadius:"50%",border:svc?.id===s.id?"none":"2px solid var(--border2)",background:svc?.id===s.id?"var(--g2)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#111",flexShrink:0}}>
                      {svc?.id===s.id && "✓"}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={goNext} disabled={!svc} style={{width:"100%",padding:14,borderRadius:12,background:svc?"var(--g)":"var(--border)",color:svc?"#fff":"var(--text3)",border:"none",fontFamily:"var(--serif)",fontSize:14,fontWeight:700,cursor:svc?"pointer":"not-allowed",transition:".2s"}}>
                Continuer → Choisir un créneau
              </button>
            </div>
          )}

          {/* STEP 2 — Slot */}
          {step === 2 && (
            <div>
              <div style={{fontFamily:"var(--serif)",fontSize:15,fontWeight:700,marginBottom:14}}>Choisissez votre créneau</div>
              <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:20,paddingBottom:4}}>
                {DATES.map(d => (
                  <div key={d.num} onClick={() => setDate(d.num)} style={{flexShrink:0,width:64,background:date===d.num?"rgba(34,211,138,.1)":"var(--card)",border:`1px solid ${date===d.num?"var(--g2)":"var(--border)"}`,borderRadius:12,padding:"8px 4px",textAlign:"center",cursor:"pointer"}}>
                    <div style={{fontSize:10,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".04em",marginBottom:4}}>{d.day}</div>
                    <div style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700}}>{d.num}</div>
                    <div style={{fontSize:10,color:"var(--g2)",marginTop:2}}>{d.avail} dispo</div>
                  </div>
                ))}
              </div>
              {[["Matin",SLOTS_AM],["Après-midi",SLOTS_PM],["Soir",SLOTS_EVE]].map(([label, slots]) => (
                <div key={label as string} style={{marginBottom:16}}>
                  <div style={{fontSize:11,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                    {label as string}
                    <div style={{flex:1,height:1,background:"var(--border)"}} />
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {(slots as string[]).map(t => (
                      <button key={t} onClick={() => setSlot(t)} style={{padding:"9px 16px",borderRadius:10,border:`1px solid ${slot===t?"var(--g2)":"var(--border2)"}`,background:slot===t?"rgba(34,211,138,.12)":"transparent",color:slot===t?"var(--g2)":"var(--text2)",fontSize:12,fontFamily:"var(--sans)",cursor:"pointer",fontWeight:slot===t?600:400,transition:".2s"}}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{display:"flex",gap:10,marginTop:24}}>
                <button onClick={goPrev} style={{flex:1,padding:12,borderRadius:12,background:"transparent",border:"1px solid var(--border2)",color:"var(--text2)",fontSize:13,fontWeight:600,cursor:"pointer"}}>← Retour</button>
                <button onClick={goNext} disabled={!slot} style={{flex:2,padding:12,borderRadius:12,background:slot?"var(--g)":"var(--border)",color:slot?"#fff":"var(--text3)",border:"none",fontFamily:"var(--serif)",fontSize:14,fontWeight:700,cursor:slot?"pointer":"not-allowed"}}>
                  Confirmer {slot && `— ${slot}`} →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Confirm */}
          {step === 3 && svc && (
            <div>
              <div style={{fontFamily:"var(--serif)",fontSize:15,fontWeight:700,marginBottom:14}}>Confirmer votre réservation</div>
              {/* Summary */}
              <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:16,padding:20,marginBottom:20}}>
                <div style={{display:"flex",gap:14,marginBottom:16}}>
                  <div style={{width:44,height:44,borderRadius:12,background:"rgba(34,211,138,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{svc.icon}</div>
                  <div>
                    <div style={{fontWeight:600,marginBottom:2}}>{svc.name}</div>
                    <div style={{fontSize:12,color:"var(--text3)"}}>⏱ {svc.dur} · 📅 Mer {date}/04 · 🕐 {slot}</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div style={{background:"rgba(255,255,255,.03)",borderRadius:10,padding:12}}>
                    <div style={{fontSize:10,color:"var(--text3)",marginBottom:3}}>Montant total</div>
                    <div style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:700}}>{svc.price.toLocaleString("fr")} FCFA</div>
                  </div>
                  <div style={{background:"rgba(34,211,138,.06)",border:"1px solid rgba(34,211,138,.15)",borderRadius:10,padding:12}}>
                    <div style={{fontSize:10,color:"var(--text3)",marginBottom:3}}>Acompte requis (30%)</div>
                    <div style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:700,color:"var(--g2)"}}>{svc.dep.toLocaleString("fr")} FCFA</div>
                  </div>
                </div>
              </div>
              {/* Phone */}
              <div style={{marginBottom:16}}>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:".06em",textTransform:"uppercase",marginBottom:6}}>Votre WhatsApp</label>
                <div style={{display:"flex",gap:0,border:"1px solid var(--border2)",borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:"10px 12px",background:"rgba(255,255,255,.04)",borderRight:"1px solid var(--border2)",fontSize:12,color:"var(--text3)",whiteSpace:"nowrap"}}>🇸🇳 +221</div>
                  <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="77 123 45 67" style={{flex:1,border:"none",borderRadius:0}} />
                </div>
              </div>
              {/* Note */}
              <div style={{marginBottom:20}}>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:".06em",textTransform:"uppercase",marginBottom:6}}>Note optionnelle</label>
                <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Précisions pour le salon…" rows={2} style={{resize:"none"}} />
              </div>
              {/* Payment */}
              <div style={{marginBottom:24}}>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:".06em",textTransform:"uppercase",marginBottom:10}}>Mode de paiement</label>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {[{id:"wave",label:"Wave",icon:"🌊"},{id:"orange",label:"Orange Money",icon:"📱"},{id:"stripe",label:"Carte Stripe",icon:"💳"}].map(p => (
                    <div key={p.id} onClick={() => setPayMethod(p.id)} style={{background:payMethod===p.id?"rgba(34,211,138,.08)":"var(--card)",border:`1px solid ${payMethod===p.id?"rgba(34,211,138,.4)":"var(--border)"}`,borderRadius:12,padding:12,textAlign:"center",cursor:"pointer",transition:".2s"}}>
                      <div style={{fontSize:22,marginBottom:4}}>{p.icon}</div>
                      <div style={{fontSize:11,fontWeight:600,color:payMethod===p.id?"var(--g2)":"var(--text2)"}}>{p.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={goPrev} style={{flex:1,padding:12,borderRadius:12,background:"transparent",border:"1px solid var(--border2)",color:"var(--text2)",fontSize:13,fontWeight:600,cursor:"pointer"}}>← Retour</button>
                <button onClick={confirmBooking} disabled={!phone || loading} style={{flex:2,padding:14,borderRadius:12,background:phone&&!loading?"var(--g)":"var(--border)",color:phone&&!loading?"#fff":"var(--text3)",border:"none",fontFamily:"var(--serif)",fontSize:14,fontWeight:700,cursor:phone&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  {loading ? <><span style={{width:16,height:16,border:"2px solid #fff",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"spin .6s linear infinite"}} /> Traitement…</> : `Payer ${svc.dep.toLocaleString("fr")} FCFA →`}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 — Success */}
          {step === 4 && done && svc && (
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:56,marginBottom:16}}>✅</div>
              <div style={{fontFamily:"var(--serif)",fontSize:24,fontWeight:700,marginBottom:8}}>Réservation confirmée !</div>
              <p style={{color:"var(--text2)",fontSize:14,marginBottom:24,lineHeight:1.6}}>
                Votre réservation pour <strong style={{color:"var(--text)"}}>{svc.name}</strong> est confirmée.<br />
                Une confirmation WhatsApp a été envoyée au +221 {phone}.
              </p>
              <div style={{background:"var(--card)",border:"1px solid rgba(34,211,138,.2)",borderRadius:16,padding:20,maxWidth:400,margin:"0 auto 28px",textAlign:"left"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,fontSize:13}}><span style={{color:"var(--text3)"}}>Service</span><span style={{fontWeight:600}}>{svc.name}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,fontSize:13}}><span style={{color:"var(--text3)"}}>Date & heure</span><span style={{fontWeight:600}}>Mer {date}/04 à {slot}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"var(--text3)"}}>Acompte payé</span><span style={{fontWeight:700,color:"var(--g2)"}}>{svc.dep.toLocaleString("fr")} FCFA</span></div>
              </div>
              <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
                <Link href="/profil" style={{padding:"12px 24px",borderRadius:12,background:"var(--g)",color:"#fff",fontFamily:"var(--serif)",fontSize:13,fontWeight:700,textDecoration:"none"}}>Voir mes réservations</Link>
                <Link href="/" style={{padding:"12px 24px",borderRadius:12,background:"transparent",border:"1px solid var(--border2)",color:"var(--text2)",fontSize:13,textDecoration:"none"}}>Retour à l'accueil</Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
