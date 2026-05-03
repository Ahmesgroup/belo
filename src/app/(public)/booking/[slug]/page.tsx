"use client";
import { useState, useEffect, use } from "react";
import { PublicNav } from "@/components/ui/Nav";
import { PhoneInput, buildFullPhone, splitPhone } from "@/components/ui/PhoneInput";
import { canUsePayment } from "@/lib/payment";
import Link from "next/link";

type Service = { id: string; name: string; category: string; priceCents: number; durationMin: number; photos: string[] };
type Slot    = { id: string; startsAt: string; endsAt: string; isAvailable: boolean };
type Tenant  = {
  id: string; name: string; slug: string; city: string | null; plan: string;
  coverUrl?: string | null; depositEnabled: boolean; depositPercent: number;
  services: Service[]; _count?: { bookings: number };
};

const ICONS: Record<string, string> = {
  hair:"💇‍♀️", HAIR:"💇‍♀️", nails:"💅", NAILS:"💅",
  massage:"💆‍♀️", MASSAGE:"💆‍♀️", barber:"✂️", BARBER:"✂️",
  spa:"🧖‍♀️", SPA:"🧖‍♀️", other:"✦", OTHER:"✦",
  beauty:"🧴", BEAUTY:"🧴", makeup:"💄", MAKEUP:"💄",
};
const icon = (cat: string) => ICONS[cat] ?? "✦";

function fmt(min: number) { return min >= 60 ? `${Math.floor(min/60)}h${min%60?String(min%60).padStart(2,"0"):""}` : `${min}min`; }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" }); }
function fmtPrice(p: number) { return p.toLocaleString("fr") + " FCFA"; }

function genDates() {
  return Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return { day: d.toLocaleDateString("fr-FR", {weekday:"short"}), num: d.getDate(), dateStr: d.toISOString().slice(0,10) };
  });
}

// ── Next.js 15/16: params is a Promise for page components ────
export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  // use() unwraps the Promise synchronously within React's Suspense protocol.
  // The component suspends while the Promise is pending, then re-renders with
  // the resolved value — no useEffect needed for slug.
  const { slug } = use(params);

  const dates = genDates();

  const [tenant,       setTenant]       = useState<Tenant | null>(null);
  const [loadErr,      setLoadErr]      = useState("");
  const [slots,        setSlots]        = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [step,        setStep]        = useState(1);
  const [svc,         setSvc]         = useState<Service | null>(null);
  const [slot,        setSlot]        = useState<Slot | null>(null);
  const [dateStr,     setDateStr]     = useState(dates[0].dateStr);
  const [countryCode, setCountryCode] = useState("221");
  const [phone,       setPhone]       = useState("");
  const [note,        setNote]        = useState("");
  const [payMethod,   setPayMethod]   = useState("wave");
  const [booking,     setBooking]     = useState(false);
  const [bookingErr,  setBookingErr]  = useState("");
  const [done,        setDone]        = useState(false);
  const [bookingRef,  setBookingRef]  = useState("");

  // Pre-fill phone from saved user profile (client-only)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("belo_user") ?? "{}");
      if (saved.phone) {
        const { countryCode: cc, local } = splitPhone(saved.phone);
        setCountryCode(cc);
        setPhone(local);
      }
    } catch { /* ignore */ }
  }, []);

  // Load tenant + services (5 s timeout)
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    fetch(`/api/tenants/${slug}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (d.data) setTenant(d.data);
        else if (d.error?.code === "NOT_FOUND") setLoadErr("Ce salon n'existe pas ou n'est plus disponible.");
        else setLoadErr("Impossible de charger ce salon. Réessayez.");
      })
      .catch(err => {
        if (err.name === "AbortError") setLoadErr("Chargement trop long. Vérifiez votre connexion.");
        else setLoadErr("Erreur de connexion. Réessayez.");
      })
      .finally(() => clearTimeout(timer));
    return () => { controller.abort(); clearTimeout(timer); };
  }, [slug]);

  // Fetch available slots when service or date changes
  const tenantId = tenant?.id ?? null;
  const svcId    = svc?.id    ?? null;

  useEffect(() => {
    if (!tenantId || !svcId) return;
    const controller = new AbortController();
    setSlotsLoading(true);
    setSlot(null);
    fetch(`/api/slots?tenantId=${tenantId}&serviceId=${svcId}&date=${dateStr}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => setSlots(d.data?.slots ?? []))
      .catch(err => { if (err.name !== "AbortError") setSlots([]); })
      .finally(() => setSlotsLoading(false));
    return () => controller.abort();
  }, [tenantId, svcId, dateStr]);

  // Payment eligibility — hides deposit/payment UI for FREE or unconfigured tenants
  const paymentEnabled = canUsePayment(tenant);

  const deposit = svc && tenant ? Math.round(svc.priceCents * (tenant.depositPercent / 100)) : 0;
  const grouped = {
    morning:   slots.filter(s => new Date(s.startsAt).getUTCHours() < 12),
    afternoon: slots.filter(s => { const h = new Date(s.startsAt).getUTCHours(); return h >= 12 && h < 17; }),
    evening:   slots.filter(s => new Date(s.startsAt).getUTCHours() >= 17),
  };

  async function confirmBooking() {
    if (!tenant || !svc || !slot) return;
    const token = localStorage.getItem("belo_token");
    if (!token) { window.location.href = `/login?redirect=/booking/${slug}`; return; }

    setBooking(true); setBookingErr("");
    try {
      const providerMap: Record<string, string> = { wave:"wave", orange:"orange_money", stripe:"stripe" };
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({
          serviceId:       svc.id,
          slotId:          slot.id,
          tenantId:        tenant.id,
          clientNote:      note || undefined,
          paymentProvider: paymentEnabled ? (providerMap[payMethod] ?? "wave") : "wave",
          idempotencyKey:  crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setBookingErr(data.error?.message || "Erreur lors de la réservation."); return; }
      setBookingRef(data.data?.id ?? "");
      setDone(true); setStep(4);
    } catch { setBookingErr("Erreur réseau. Veuillez réessayer."); }
    finally { setBooking(false); }
  }

  // ── Error / loading states ────────────────────────────────────

  if (loadErr) return (
    <>
      <PublicNav />
      <main style={{paddingTop:56,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
          <div style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700,marginBottom:8}}>{loadErr}</div>
          <Link href="/salons" style={{color:"var(--g2)",fontSize:13}}>← Retour aux salons</Link>
        </div>
      </main>
    </>
  );

  if (!tenant) return (
    <>
      <PublicNav />
      <main style={{paddingTop:56,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
        <div style={{textAlign:"center"}}>
          <div style={{width:40,height:40,border:"3px solid var(--border2)",borderTopColor:"var(--g2)",borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 12px"}} />
          <div style={{fontSize:13,color:"var(--text3)"}}>Chargement…</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </main>
    </>
  );

  return (
    <>
      <PublicNav />
      <main style={{paddingTop:56}}>
        <div style={{maxWidth:760,margin:"0 auto",padding:"32px 20px 60px"}}>

          <Link href="/salons" style={{fontSize:12,color:"var(--text3)",textDecoration:"none",marginBottom:16,display:"block"}}>← Retour aux salons</Link>

          {/* Salon header */}
          <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:16,overflow:"hidden",marginBottom:24}}>
            <div style={{height:160,position:"relative",overflow:"hidden",background:"linear-gradient(135deg,#0d2d1a,#1a3a2a)"}}>
              {tenant.coverUrl ? (
                <img src={tenant.coverUrl} alt={tenant.name} style={{width:"100%",height:"100%",objectFit:"cover",opacity:.85}} />
              ) : (
                <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:48}}>
                  {icon(tenant.services[0]?.category ?? "")}
                </div>
              )}
              <div style={{position:"absolute",bottom:10,left:14,background:"rgba(0,0,0,.55)",borderRadius:99,padding:"3px 10px",fontSize:11,color:"#fff",fontWeight:600}}>
                ★ {(tenant._count?.bookings ?? 0) > 0 ? "4.8" : "Nouveau"} · {tenant._count?.bookings ?? 0} réservation{(tenant._count?.bookings ?? 0) !== 1 ? "s" : ""}
              </div>
            </div>
            <div style={{padding:"12px 16px"}}>
              <div style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:700,marginBottom:2}}>{tenant.name}</div>
              {tenant.city && <div style={{fontSize:12,color:"var(--text3)",marginBottom:6}}>📍 {tenant.city}</div>}
              <div style={{fontSize:12,color:"var(--text2)",lineHeight:1.5}}>
                {tenant.services.length} service{tenant.services.length !== 1 ? "s" : ""} disponible{tenant.services.length !== 1 ? "s" : ""} · Confirmation WhatsApp instantanée
              </div>
            </div>
          </div>

          {/* Step tabs */}
          <div style={{display:"flex",alignItems:"center",background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden",marginBottom:32}}>
            {[{n:1,l:"Service"},{n:2,l:"Créneau"},{n:3,l:"Confirmer"},{n:4,l:"✓ Réservé"}].map(({n,l}) => {
              const isDone = step > n; const isActive = step === n;
              return (
                <div key={n} onClick={() => n < step && setStep(n)} style={{flex:1,padding:"14px 12px",textAlign:"center",fontSize:11,fontWeight:600,color:isDone?"var(--g2)":isActive?"var(--text)":"var(--text3)",cursor:n < step?"pointer":"default",background:isDone?"rgba(34,211,138,.05)":isActive?"rgba(255,255,255,.04)":"transparent",borderRight:"1px solid var(--border)",transition:".2s"}}>
                  <div style={{width:20,height:20,borderRadius:"50%",background:isDone?"var(--g)":isActive?"var(--g2)":"var(--border2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,margin:"0 auto 4px",color:isDone||isActive?"#111":"var(--text3)"}}>{isDone?"✓":n}</div>
                  {l}
                </div>
              );
            })}
          </div>

          {/* ── STEP 1 — Service ── */}
          {step === 1 && (
            <div>
              <div style={{fontFamily:"var(--serif)",fontSize:15,fontWeight:700,marginBottom:14}}>Choisissez votre prestation</div>
              {tenant.services.length === 0 ? (
                <div style={{textAlign:"center",padding:"40px 0",color:"var(--text3)",fontSize:13}}>Aucun service disponible pour ce salon.</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
                  {tenant.services.map(s => (
                    <div key={s.id} onClick={() => setSvc(s)} style={{background:svc?.id===s.id?"rgba(34,211,138,.04)":"var(--card)",border:`1px solid ${svc?.id===s.id?"rgba(34,211,138,.4)":"var(--border)"}`,borderRadius:16,padding:16,display:"flex",alignItems:"center",gap:14,cursor:"pointer",transition:".2s"}}>
                      <div style={{width:44,height:44,borderRadius:12,background:"rgba(34,211,138,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{icon(s.category)}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:14,marginBottom:2}}>{s.name}</div>
                        <div style={{fontSize:11,color:"var(--text3)"}}>⏱ {fmt(s.durationMin)}</div>
                      </div>
                      <div style={{fontFamily:"var(--serif)",fontSize:16,fontWeight:700,color:"var(--g2)",whiteSpace:"nowrap"}}>{fmtPrice(s.priceCents)}</div>
                      <div style={{width:20,height:20,borderRadius:"50%",border:svc?.id===s.id?"none":"2px solid var(--border2)",background:svc?.id===s.id?"var(--g2)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#111",flexShrink:0}}>{svc?.id===s.id&&"✓"}</div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setStep(2)} disabled={!svc} style={{width:"100%",padding:14,borderRadius:12,background:svc?"var(--g)":"var(--border)",color:svc?"#fff":"var(--text3)",border:"none",fontFamily:"var(--serif)",fontSize:14,fontWeight:700,cursor:svc?"pointer":"not-allowed",transition:".2s"}}>
                Continuer → Choisir un créneau
              </button>
            </div>
          )}

          {/* ── STEP 2 — Slot ── */}
          {step === 2 && (
            <div>
              <div style={{fontFamily:"var(--serif)",fontSize:15,fontWeight:700,marginBottom:14}}>Choisissez votre créneau</div>
              <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:20,paddingBottom:4}}>
                {dates.map(d => (
                  <div key={d.dateStr} onClick={() => setDateStr(d.dateStr)} style={{flexShrink:0,width:64,background:dateStr===d.dateStr?"rgba(34,211,138,.1)":"var(--card)",border:`1px solid ${dateStr===d.dateStr?"var(--g2)":"var(--border)"}`,borderRadius:12,padding:"8px 4px",textAlign:"center",cursor:"pointer"}}>
                    <div style={{fontSize:10,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".04em",marginBottom:4}}>{d.day}</div>
                    <div style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700}}>{d.num}</div>
                  </div>
                ))}
              </div>
              {slotsLoading && <div style={{textAlign:"center",padding:"20px 0",color:"var(--text3)",fontSize:13}}>Chargement des créneaux…</div>}
              {!slotsLoading && slots.length === 0 && (
                <div style={{textAlign:"center",padding:"24px",background:"rgba(255,255,255,.03)",borderRadius:12,color:"var(--text3)",fontSize:13,marginBottom:16}}>
                  Aucun créneau disponible ce jour. Essayez une autre date.
                </div>
              )}
              {!slotsLoading && [["Matin", grouped.morning], ["Après-midi", grouped.afternoon], ["Soir", grouped.evening]].map(([label, group]) => (
                (group as Slot[]).length > 0 && (
                  <div key={label as string} style={{marginBottom:16}}>
                    <div style={{fontSize:11,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                      {label as string}<div style={{flex:1,height:1,background:"var(--border)"}} />
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {(group as Slot[]).map(s => (
                        <button key={s.id} onClick={() => setSlot(s)} style={{padding:"9px 16px",borderRadius:10,border:`1px solid ${slot?.id===s.id?"var(--g2)":"var(--border2)"}`,background:slot?.id===s.id?"rgba(34,211,138,.12)":"transparent",color:slot?.id===s.id?"var(--g2)":"var(--text2)",fontSize:12,cursor:"pointer",fontWeight:slot?.id===s.id?600:400,transition:".2s"}}>
                          {fmtTime(s.startsAt)}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              ))}
              <div style={{display:"flex",gap:10,marginTop:24}}>
                <button onClick={() => setStep(1)} style={{flex:1,padding:12,borderRadius:12,background:"transparent",border:"1px solid var(--border2)",color:"var(--text2)",fontSize:13,fontWeight:600,cursor:"pointer"}}>← Retour</button>
                <button onClick={() => setStep(3)} disabled={!slot} style={{flex:2,padding:12,borderRadius:12,background:slot?"var(--g)":"var(--border)",color:slot?"#fff":"var(--text3)",border:"none",fontFamily:"var(--serif)",fontSize:14,fontWeight:700,cursor:slot?"pointer":"not-allowed"}}>
                  Confirmer {slot ? `— ${fmtTime(slot.startsAt)}` : ""} →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3 — Confirm ── */}
          {step === 3 && svc && slot && (
            <div>
              <div style={{fontFamily:"var(--serif)",fontSize:15,fontWeight:700,marginBottom:14}}>Confirmer votre réservation</div>

              {/* Booking summary */}
              <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:16,padding:20,marginBottom:20}}>
                <div style={{display:"flex",gap:14,marginBottom:16}}>
                  <div style={{width:44,height:44,borderRadius:12,background:"rgba(34,211,138,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{icon(svc.category)}</div>
                  <div>
                    <div style={{fontWeight:600,marginBottom:2}}>{svc.name}</div>
                    <div style={{fontSize:12,color:"var(--text3)"}}>⏱ {fmt(svc.durationMin)} · 📅 {new Date(slot.startsAt).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} · 🕐 {fmtTime(slot.startsAt)}</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:paymentEnabled?"1fr 1fr":"1fr",gap:12}}>
                  <div style={{background:"rgba(255,255,255,.03)",borderRadius:10,padding:12}}>
                    <div style={{fontSize:10,color:"var(--text3)",marginBottom:3}}>Montant total</div>
                    <div style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:700}}>{fmtPrice(svc.priceCents)}</div>
                  </div>
                  {paymentEnabled && (
                    <div style={{background:"rgba(34,211,138,.06)",border:"1px solid rgba(34,211,138,.15)",borderRadius:10,padding:12}}>
                      <div style={{fontSize:10,color:"var(--text3)",marginBottom:3}}>Acompte ({tenant.depositPercent}%)</div>
                      <div style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:700,color:"var(--g2)"}}>{fmtPrice(deposit)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* WhatsApp — shared PhoneInput component */}
              <div style={{marginBottom:16}}>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:".06em",textTransform:"uppercase",marginBottom:6}}>Votre WhatsApp</label>
                <PhoneInput
                  countryCode={countryCode}
                  localNumber={phone}
                  onCountryChange={setCountryCode}
                  onNumberChange={setPhone}
                />
              </div>

              {/* Optional note */}
              <div style={{marginBottom:20}}>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:".06em",textTransform:"uppercase",marginBottom:6}}>Note optionnelle</label>
                <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Précisions pour le salon…" rows={2} style={{width:"100%",resize:"none",padding:"10px 12px",borderRadius:10,border:"1px solid var(--border2)",background:"rgba(255,255,255,.04)",fontSize:13,color:"var(--text)",boxSizing:"border-box"}} />
              </div>

              {/* Payment methods — only PRO/PREMIUM with deposit configured */}
              {paymentEnabled ? (
                <div style={{marginBottom:24}}>
                  <label style={{display:"block",fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:".06em",textTransform:"uppercase",marginBottom:10}}>Mode de paiement</label>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                    {[{id:"wave",label:"Wave",icon:"🌊"},{id:"orange",label:"Orange Money",icon:"📱"},{id:"stripe",label:"Carte",icon:"💳"}].map(p => (
                      <div key={p.id} onClick={() => setPayMethod(p.id)} style={{background:payMethod===p.id?"rgba(34,211,138,.08)":"var(--card)",border:`1px solid ${payMethod===p.id?"rgba(34,211,138,.4)":"var(--border)"}`,borderRadius:12,padding:12,textAlign:"center",cursor:"pointer",transition:".2s"}}>
                        <div style={{fontSize:22,marginBottom:4}}>{p.icon}</div>
                        <div style={{fontSize:11,fontWeight:600,color:payMethod===p.id?"var(--g2)":"var(--text2)"}}>{p.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{marginBottom:24,padding:"12px 14px",background:"rgba(34,211,138,.05)",border:"1px solid rgba(34,211,138,.15)",borderRadius:10,fontSize:12,color:"var(--text2)"}}>
                  ✓ Paiement directement en salon — aucun acompte requis.
                </div>
              )}

              {bookingErr && <div style={{color:"var(--red)",fontSize:12,marginBottom:12,padding:"10px 14px",background:"rgba(239,68,68,.06)",borderRadius:8}}>{bookingErr}</div>}

              <div style={{display:"flex",gap:10}}>
                <button onClick={() => setStep(2)} style={{flex:1,padding:12,borderRadius:12,background:"transparent",border:"1px solid var(--border2)",color:"var(--text2)",fontSize:13,fontWeight:600,cursor:"pointer"}}>← Retour</button>
                <button
                  onClick={confirmBooking}
                  disabled={!phone || booking}
                  style={{flex:2,padding:14,borderRadius:12,background:phone&&!booking?"var(--g)":"var(--border)",color:phone&&!booking?"#fff":"var(--text3)",border:"none",fontFamily:"var(--serif)",fontSize:14,fontWeight:700,cursor:phone&&!booking?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
                >
                  {booking
                    ? <><span style={{width:16,height:16,border:"2px solid #fff",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .6s linear infinite"}} /> Traitement…</>
                    : paymentEnabled
                      ? `Payer ${fmtPrice(deposit)} →`
                      : "Confirmer →"
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4 — Success ── */}
          {step === 4 && done && svc && slot && (
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:56,marginBottom:16}}>✅</div>
              <div style={{fontFamily:"var(--serif)",fontSize:24,fontWeight:700,marginBottom:8}}>Réservation confirmée !</div>
              <p style={{color:"var(--text2)",fontSize:14,marginBottom:24,lineHeight:1.6}}>
                Votre réservation pour <strong style={{color:"var(--text)"}}>{svc.name}</strong> est confirmée.<br />
                Une confirmation WhatsApp a été envoyée au {buildFullPhone(countryCode, phone)}.
              </p>
              <div style={{background:"var(--card)",border:"1px solid rgba(34,211,138,.2)",borderRadius:16,padding:20,maxWidth:400,margin:"0 auto 28px",textAlign:"left"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,fontSize:13}}><span style={{color:"var(--text3)"}}>Service</span><span style={{fontWeight:600}}>{svc.name}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,fontSize:13}}><span style={{color:"var(--text3)"}}>Date & heure</span><span style={{fontWeight:600}}>{new Date(slot.startsAt).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})} à {fmtTime(slot.startsAt)}</span></div>
                {bookingRef && <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span style={{color:"var(--text3)"}}>Référence</span><span style={{fontFamily:"monospace",color:"var(--text3)"}}>{bookingRef.slice(0,12)}…</span></div>}
              </div>
              <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
                <Link href="/profil" style={{padding:"12px 24px",borderRadius:12,background:"var(--g)",color:"#fff",fontFamily:"var(--serif)",fontSize:13,fontWeight:700,textDecoration:"none"}}>Voir mes réservations</Link>
                <Link href="/" style={{padding:"12px 24px",borderRadius:12,background:"transparent",border:"1px solid var(--border2)",color:"var(--text2)",fontSize:13,textDecoration:"none"}}>Retour à l'accueil</Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
