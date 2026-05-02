"use client";
import { useState, useEffect } from "react";
import { PublicNav } from "@/components/ui/Nav";
import Link from "next/link";

type Tenant = { id: string; name: string; slug: string; city: string | null; plan: string; _count: { bookings: number } };

const planBadge = (p: string) =>
  p === "PREMIUM" ? { bg:"rgba(144,96,232,.12)", color:"var(--purple)", text:"★ Premium" } :
  p === "PRO"     ? { bg:"rgba(245,166,35,.12)",  color:"var(--amber)",  text:"⚡ PRO" } :
                    { bg:"rgba(34,211,138,.12)",   color:"var(--g2)",    text:"● Disponible" };

export default function LandingPage() {
  const [salons,      setSalons]      = useState<Tenant[]>([]);
  const [salonTotal,  setSalonTotal]  = useState(0);

  useEffect(() => {
    fetch("/api/tenants?pageSize=4")
      .then(r => r.json())
      .then(d => {
        if (d.data?.tenants) setSalons(d.data.tenants);
        if (d.data?.pagination?.total) setSalonTotal(d.data.pagination.total);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <PublicNav />
      <main style={{paddingTop:56}}>

        {/* HERO */}
        <section style={{minHeight:"calc(100vh - 56px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 5vw 40px",textAlign:"center",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:"15%",left:"50%",transform:"translateX(-50%)",width:600,height:400,background:"radial-gradient(ellipse at center,rgba(34,211,138,.07) 0%,transparent 70%)",pointerEvents:"none"}} />
          <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px)",backgroundSize:"60px 60px",maskImage:"radial-gradient(ellipse at center,black 0%,transparent 70%)"}} />

          <div style={{position:"relative",zIndex:1,maxWidth:720,width:"100%"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(34,211,138,.08)",border:"1px solid rgba(34,211,138,.18)",color:"var(--g2)",fontSize:11,fontWeight:600,padding:"5px 14px",borderRadius:99,marginBottom:24,letterSpacing:".06em"}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:"var(--g2)",animation:"pulse 2s infinite"}} />
              ✦ Disponible à Dakar, Thiès, Saint-Louis
            </div>

            <h1 style={{fontFamily:"var(--serif)",fontSize:"clamp(36px,5.5vw,68px)",fontWeight:800,lineHeight:1.08,letterSpacing:"-.03em",marginBottom:20}}>
              La beauté réservée<br />en <span style={{color:"var(--g2)",fontStyle:"italic"}}>45 secondes</span>.<br /><span style={{color:"var(--text2)"}}>Confirmée sur WhatsApp.</span>
            </h1>

            <p style={{fontSize:16,color:"var(--text2)",lineHeight:1.7,maxWidth:520,margin:"0 auto 32px"}}>
              Trouvez les meilleurs salons de coiffure, de beauté et de bien-être. Payez par Wave ou Orange Money. Annulez sans frais.
            </p>

            <div style={{background:"var(--card)",border:"1px solid var(--border2)",borderRadius:14,padding:5,display:"flex",flexWrap:"wrap",gap:0,maxWidth:600,width:"100%",margin:"0 auto 16px"}}>
              <div style={{flex:1,minWidth:130,display:"flex",alignItems:"center",gap:8,padding:"9px 13px"}}>
                <span style={{fontSize:13,color:"var(--text3)"}}>🔍</span>
                <input placeholder="Coiffure, manucure, massage…" style={{flex:1,background:"transparent",border:"none",outline:"none",fontFamily:"var(--sans)",fontSize:13,color:"var(--text)"}} />
              </div>
              <div style={{width:1,background:"var(--border)",margin:"5px 0"}} />
              <div style={{flex:1,minWidth:130,display:"flex",alignItems:"center",gap:8,padding:"9px 13px"}}>
                <span style={{fontSize:13,color:"var(--text3)"}}>📍</span>
                <input placeholder="Dakar, Thiès…" style={{flex:1,background:"transparent",border:"none",outline:"none",fontFamily:"var(--sans)",fontSize:13,color:"var(--text)"}} />
              </div>
              <Link href="/salons" style={{background:"var(--g)",color:"#fff",border:"none",padding:"10px 20px",borderRadius:10,fontFamily:"var(--sans)",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",textDecoration:"none",display:"flex",alignItems:"center",gap:6}}>
                Chercher →
              </Link>
            </div>

            <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",marginBottom:28}}>
              {["✦ Tous","💇‍♀️ Coiffure","💅 Manucure","💆‍♀️ Massage","🧖‍♀️ Soins","💄 Maquillage","🧴 Épilation"].map(cat => (
                <Link key={cat} href={`/salons?cat=${cat}`} style={{padding:"5px 13px",borderRadius:99,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:11,textDecoration:"none"}}>{cat}</Link>
              ))}
            </div>

            <div style={{display:"flex",border:"1px solid var(--border)",borderRadius:14,overflow:"hidden",maxWidth:600,width:"100%",margin:"0 auto",background:"rgba(11,15,22,.8)",backdropFilter:"blur(8px)"}}>
              {[["14k+","Réservations/mois"],[salonTotal > 0 ? `${salonTotal}+` : "…+","Salons partenaires"],["4.9★","Note moyenne"],["Wave ✓","+ Orange Money"]].map(([n,l]) => (
                <div key={l} style={{flex:1,padding:"16px 18px",textAlign:"center",borderRight:"1px solid var(--border)"}}>
                  <div style={{fontFamily:"var(--serif)",fontSize:22,fontWeight:700,color:"var(--g2)",lineHeight:1,marginBottom:3}}>{n}</div>
                  <div style={{fontSize:10,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em"}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SALONS EN VEDETTE */}
        <section style={{padding:"48px 5vw",maxWidth:1200,margin:"0 auto"}} id="salons">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
            <h2 style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700}}>Salons en vedette</h2>
            <Link href="/salons" style={{padding:"7px 14px",borderRadius:9,fontSize:12,fontWeight:600,border:"1px solid var(--border2)",color:"var(--text2)",textDecoration:"none"}}>Voir tout →</Link>
          </div>
          {salons.length === 0 ? (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16}}>
              {Array.from({length:4}).map((_,i) => (
                <div key={i} style={{background:"rgba(255,255,255,.03)",border:"1px solid var(--border)",borderRadius:16,overflow:"hidden"}}>
                  <div style={{height:140,background:"rgba(255,255,255,.05)"}} />
                  <div style={{padding:14}}>
                    <div style={{height:16,width:"60%",background:"rgba(255,255,255,.06)",borderRadius:5,marginBottom:10}} />
                    <div style={{height:32,background:"rgba(255,255,255,.04)",borderRadius:9}} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16}}>
              {salons.map(s => {
                const b = planBadge(s.plan);
                return (
                  <div key={s.id} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:16,overflow:"hidden",cursor:"pointer",transition:".25s"}} className="salon-hover">
                    <div style={{height:140,background:"linear-gradient(135deg,#1a2a1a,#0d2d1a)",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40}}>
                      💇‍♀️
                      <div style={{position:"absolute",top:10,right:10,background:b.bg,color:b.color,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:99,border:`1px solid ${b.color}33`}}>{b.text}</div>
                    </div>
                    <div style={{padding:14}}>
                      <div style={{fontFamily:"var(--serif)",fontSize:14,fontWeight:600,marginBottom:4}}>{s.name}</div>
                      {s.city && <div style={{fontSize:11,color:"var(--text3)",marginBottom:10}}>📍 {s.city}</div>}
                      <Link href={`/booking/${s.slug}`} style={{display:"block",width:"100%",padding:"8px",borderRadius:9,background:"var(--g)",color:"#fff",fontSize:12,fontWeight:600,textAlign:"center",textDecoration:"none",transition:".2s"}}>
                        Réserver →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* HOW IT WORKS */}
        <section id="how" style={{padding:"60px 5vw",background:"rgba(11,15,22,.4)",borderTop:"1px solid var(--border)"}}>
          <div style={{maxWidth:1000,margin:"0 auto",textAlign:"center"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(34,211,138,.08)",border:"1px solid rgba(34,211,138,.18)",color:"var(--g2)",fontSize:11,fontWeight:600,padding:"4px 12px",borderRadius:99,marginBottom:16,letterSpacing:".06em"}}>Comment ça marche</div>
            <h2 style={{fontFamily:"var(--serif)",fontSize:"clamp(24px,4vw,40px)",fontWeight:800,marginBottom:12,letterSpacing:"-.02em"}}>Réserver en <span style={{color:"var(--g2)"}}>4 étapes</span></h2>
            <p style={{color:"var(--text2)",fontSize:15,marginBottom:40}}>Conçu pour que votre réservation soit faite avant même de finir votre thé.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:20}}>
              {[
                { n:"1", icon:"🔍", title:"Choisissez votre service", sub:"Ongles, massage, coiffure — parcourez les salons près de vous.", time:"⏱ 10 secondes" },
                { n:"2", icon:"🕐", title:"Sélectionnez un créneau", sub:"Les créneaux s'affichent en temps réel. Choisissez votre heure.", time:"⏱ 10 secondes" },
                { n:"3", icon:"💳", title:"Confirmez & payez", sub:"Wave, Orange Money ou carte. Paiement sécurisé en 1 clic.", time:"⏱ 15 secondes" },
                { n:"4", icon:"✅", title:"C'est confirmé !", sub:"Vous recevez une confirmation WhatsApp. Le salon est notifié.", time:"⚡ Instantané" },
              ].map(s => (
                <div key={s.n} style={{textAlign:"center",padding:"0 16px"}}>
                  <div style={{width:56,height:56,borderRadius:"50%",background:"var(--card)",border:"1px solid var(--border2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 16px"}}>{s.icon}</div>
                  <div style={{fontFamily:"var(--serif)",fontWeight:600,fontSize:14,marginBottom:8}}>{s.title}</div>
                  <div style={{fontSize:12,color:"var(--text3)",lineHeight:1.5,marginBottom:10}}>{s.sub}</div>
                  <span style={{display:"inline-block",fontSize:10,fontWeight:600,color:"var(--g2)",background:"rgba(34,211,138,.08)",border:"1px solid rgba(34,211,138,.15)",padding:"3px 10px",borderRadius:99}}>{s.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{padding:"60px 5vw",textAlign:"center"}}>
          <div style={{maxWidth:600,margin:"0 auto",background:"var(--card)",border:"1px solid var(--border2)",borderRadius:24,padding:"48px 32px"}}>
            <h2 style={{fontFamily:"var(--serif)",fontSize:"clamp(24px,4vw,40px)",fontWeight:800,marginBottom:12,letterSpacing:"-.02em"}}>Votre prochain rendez-vous <span style={{color:"var(--g2)",fontStyle:"italic"}}>vous attend là</span></h2>
            <p style={{color:"var(--text2)",marginBottom:28}}>{salonTotal > 0 ? salonTotal : "…"} salons disponibles. Réservation en 45 secondes. Confirmation immédiate.</p>
            <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
              <Link href="/salons" style={{padding:"13px 26px",borderRadius:12,background:"var(--g)",color:"#fff",fontFamily:"var(--serif)",fontSize:14,fontWeight:700,textDecoration:"none"}}>✦ Trouver un salon</Link>
              <Link href="/plans" style={{padding:"13px 26px",borderRadius:12,background:"rgba(255,255,255,.06)",color:"var(--text)",border:"1px solid var(--border2)",fontFamily:"var(--sans)",fontSize:14,textDecoration:"none"}}>📲 Pour les salons</Link>
            </div>
            <p style={{marginTop:20,fontSize:11,color:"var(--text3)"}}>Gratuit · Annulation sans frais · Paiement sécurisé</p>
          </div>
        </section>

        <footer style={{padding:"32px 5vw",borderTop:"1px solid var(--border)",textAlign:"center"}}>
          <div style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:700,marginBottom:6}}>belo<span style={{color:"var(--g2)"}}>.</span></div>
          <div style={{display:"flex",gap:20,justifyContent:"center",flexWrap:"wrap",marginBottom:12}}>
            {["À propos","Salons","Pour les gérants","Plans","Confidentialité","Contact"].map(l => (
              <Link key={l} href="#" style={{fontSize:12,color:"var(--text3)",textDecoration:"none"}}>{l}</Link>
            ))}
          </div>
          <p style={{fontSize:11,color:"var(--text3)"}}>© 2026 Belo · Dakar, Sénégal — La beauté réservée en 45 secondes</p>
        </footer>

      </main>
      <style>{`.salon-hover:hover{border-color:rgba(34,211,138,.3)!important;transform:translateY(-3px)}`}</style>
    </>
  );
}
