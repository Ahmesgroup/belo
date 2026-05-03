"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/hooks/useLang";
import { PublicNav } from "@/components/ui/Nav";
import { PhoneInput, buildFullPhone } from "@/components/ui/PhoneInput";
import Link from "next/link";

export default function LoginPage() {
  const { t }  = useLang();
  const router = useRouter();
  const [step,        setStep]        = useState("phone");
  const [countryCode, setCountryCode] = useState("221");
  const [phone,       setPhone]       = useState("");
  const [otp,         setOtp]         = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  const fullPhone = buildFullPhone(countryCode, phone);

  // Canonicalises any phone string to E.164, preventing duplicate users.
  // Handles: "+221771234567", "221771234567", "771234567", "0771234567".
  function normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("221") && digits.length >= 11) return `+${digits}`;
    if (digits.startsWith("0") && digits.length === 10) return `+221${digits.slice(1)}`;
    if (digits.length === 9) return `+221${digits}`;
    return `+${digits}`;
  }

  async function sendOtp() {
    if (!phone || phone.replace(/\s/g, "").length < 6) { setError("Numéro invalide"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth?action=send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizePhone(fullPhone) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message || "Erreur"); return; }
      setStep("otp");
    } catch { setError("Erreur réseau"); } finally { setLoading(false); }
  }

  async function verifyOtp() {
    if (otp.length !== 6) { setError("Code 6 chiffres"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth?action=verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizePhone(fullPhone), otp }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message || "Code incorrect"); return; }
      localStorage.setItem("belo_token", data.data.accessToken);
      localStorage.setItem("belo_user", JSON.stringify(data.data.user));

      const role = data.data.user?.role as string | undefined;
      const redirectParam = new URLSearchParams(window.location.search).get("redirect");
      const dest =
        redirectParam ??
        (role === "ADMIN" || role === "SUPER_ADMIN"
          ? "/admin"
          : role === "OWNER" || role === "STAFF"
          ? "/dashboard"
          : "/profil");

      router.replace(dest);
    } catch { setError("Erreur réseau"); } finally { setLoading(false); }
  }

  return (
    <>
      <PublicNav />
      <main style={{paddingTop:56,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"80px 20px"}}>
        <div style={{width:"100%",maxWidth:400}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontFamily:"var(--serif)",fontSize:32,fontWeight:800}}>belo<span style={{color:"var(--g2)"}}>.</span></div>
            <p style={{color:"var(--text2)",fontSize:14,marginTop:8}}>
              {step === "phone" ? t("login_title") : t("code_title")}
            </p>
          </div>

          <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:20,padding:28}}>
            {step === "phone" ? (
              <>
                <div style={{marginBottom:16}}>
                  <PhoneInput
                    countryCode={countryCode}
                    localNumber={phone}
                    onCountryChange={setCountryCode}
                    onNumberChange={setPhone}
                    onEnter={sendOtp}
                    fontSize={15}
                    autoFocus
                  />
                </div>
                <div style={{fontSize:11,color:"var(--text3)",marginBottom:12,textAlign:"center"}}>
                  {fullPhone}
                </div>
                {error && <div style={{color:"var(--red)",fontSize:12,marginBottom:12}}>{error}</div>}
                <button type="button" onClick={sendOtp} disabled={loading}
                  style={{width:"100%",padding:14,borderRadius:12,border:"none",background:"var(--g)",color:"#fff",fontFamily:"var(--serif)",fontSize:15,fontWeight:700,cursor:"pointer"}}>
                  {loading ? "Envoi..." : t("send_code")}
                </button>
              </>
            ) : (
              <>
                <div style={{marginBottom:16,padding:"10px 14px",background:"rgba(34,211,138,.06)",border:"1px solid rgba(34,211,138,.15)",borderRadius:10,fontSize:12,color:"var(--text2)"}}>
                  {fullPhone}
                  <button type="button" onClick={() => { setStep("phone"); setOtp(""); }}
                    style={{marginLeft:8,color:"var(--g2)",background:"none",border:"none",cursor:"pointer",fontSize:11}}>
                    Modifier
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g,"").slice(0,6))}
                  onKeyDown={e => e.key === "Enter" && verifyOtp()}
                  placeholder="123456"
                  autoFocus
                  maxLength={6}
                  style={{textAlign:"center",fontSize:28,fontFamily:"var(--serif)",fontWeight:700,letterSpacing:12,marginBottom:16,padding:"14px"}}
                />
                {error && <div style={{color:"var(--red)",fontSize:12,marginBottom:12}}>{error}</div>}
                <button type="button" onClick={verifyOtp} disabled={loading || otp.length !== 6}
                  style={{width:"100%",padding:14,borderRadius:12,border:"none",background:otp.length===6?"var(--g)":"var(--border)",color:"#fff",fontFamily:"var(--serif)",fontSize:15,fontWeight:700,cursor:"pointer"}}>
                  {loading ? "Vérification..." : t("connect")}
                </button>
                <button type="button" onClick={sendOtp}
                  style={{width:"100%",marginTop:10,padding:10,borderRadius:10,border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",fontSize:12,cursor:"pointer"}}>
                  {t("resend")}
                </button>
              </>
            )}
          </div>

          <div style={{textAlign:"center",marginTop:20}}>
            <Link href="/" style={{fontSize:12,color:"var(--text3)",textDecoration:"none"}}>{t("back_home")}</Link>
          </div>
        </div>
      </main>
    </>
  );
}
