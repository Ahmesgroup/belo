"use client";
import { useState } from "react";
import { PublicNav } from "@/components/ui/Nav";
import Link from "next/link";

export default function LoginPage() {
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendOtp() {
    if (!phone || phone.length < 8) { setError("Numero invalide"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth?action=send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "+221" + phone.replace(/\s/g, "") }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message || "Erreur"); return; }
      setStep("otp");
    } catch { setError("Erreur reseau"); } finally { setLoading(false); }
  }

  async function verifyOtp() {
    if (otp.length !== 6) { setError("Code 6 chiffres"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth?action=verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "+221" + phone.replace(/\s/g, ""), otp }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message || "Code incorrect"); return; }
      localStorage.setItem("belo_token", data.data.accessToken);
      localStorage.setItem("belo_user", JSON.stringify(data.data.user));
      const role = data.data.user.role;
      const dest = (role === "SUPER_ADMIN" || role === "ADMIN") ? "/admin" : (role === "OWNER" || role === "STAFF") ? "/dashboard" : "/profil";
      window.location.replace(dest);
    } catch { setError("Erreur reseau"); } finally { setLoading(false); }
  }

  return (
    <>
      <PublicNav />
      <main style={{paddingTop:56,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"80px 20px"}}>
        <div style={{width:"100%",maxWidth:400}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontFamily:"var(--serif)",fontSize:32,fontWeight:800}}>belo<span style={{color:"var(--g2)"}}>.</span></div>
            <p style={{color:"var(--text2)",fontSize:14,marginTop:8}}>{step === "phone" ? "Entrez votre numero WhatsApp" : "Code recu sur WhatsApp"}</p>
          </div>
          <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:20,padding:28}}>
            {step === "phone" ? (
              <>
                <div style={{display:"flex",border:"1px solid var(--border2)",borderRadius:12,overflow:"hidden",marginBottom:16}}>
                  <div style={{padding:"12px 14px",background:"rgba(255,255,255,.04)",borderRight:"1px solid var(--border2)",fontSize:13,color:"var(--text2)"}}>+221</div>
                  <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendOtp()} placeholder="77 123 45 67" autoFocus style={{flex:1,border:"none",borderRadius:0,padding:"12px 14px",fontSize:15,background:"transparent"}} />
                </div>
                {error && <div style={{color:"var(--red)",fontSize:12,marginBottom:12}}>{error}</div>}
                <button onClick={sendOtp} disabled={loading} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:"var(--g)",color:"#fff",fontFamily:"var(--serif)",fontSize:15,fontWeight:700,cursor:"pointer"}}>{loading ? "Envoi..." : "Envoyer le code"}</button>
                <div style={{textAlign:"center",marginTop:12,fontSize:11,color:"var(--text3)"}}>Code OTP visible dans le terminal en mode dev</div>
              </>
            ) : (
              <>
                <div style={{marginBottom:16,padding:"10px 14px",background:"rgba(34,211,138,.06)",border:"1px solid rgba(34,211,138,.15)",borderRadius:10,fontSize:12,color:"var(--text2)"}}>+221 {phone} <button onClick={()=>{setStep("phone");setOtp("");}} style={{marginLeft:8,color:"var(--g2)",background:"none",border:"none",cursor:"pointer",fontSize:11}}>Modifier</button></div>
                <input type="text" inputMode="numeric" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} onKeyDown={e=>e.key==="Enter"&&verifyOtp()} placeholder="123456" autoFocus maxLength={6} style={{textAlign:"center",fontSize:28,fontFamily:"var(--serif)",fontWeight:700,letterSpacing:12,marginBottom:16,padding:"14px"}} />
                {error && <div style={{color:"var(--red)",fontSize:12,marginBottom:12}}>{error}</div>}
                <button onClick={verifyOtp} disabled={loading||otp.length!==6} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:otp.length===6?"var(--g)":"var(--border)",color:"#fff",fontFamily:"var(--serif)",fontSize:15,fontWeight:700,cursor:"pointer"}}>{loading ? "Verification..." : "Se connecter"}</button>
                <button onClick={sendOtp} style={{width:"100%",marginTop:10,padding:10,borderRadius:10,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:12,cursor:"pointer"}}>Renvoyer le code</button>
              </>
            )}
          </div>
          <div style={{textAlign:"center",marginTop:20}}><Link href="/" style={{fontSize:12,color:"var(--text3)",textDecoration:"none"}}>Retour accueil</Link></div>
        </div>
      </main>
    </>
  );
}
