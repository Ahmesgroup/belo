"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, getToken, setAuth } from "@/lib/auth-client";

const CATEGORIES = [
  { value: "HAIR",    label: "Coiffure",     emoji: "💇‍♀️" },
  { value: "BARBER",  label: "Barbier",      emoji: "💈" },
  { value: "NAILS",   label: "Ongles",       emoji: "💅" },
  { value: "BEAUTY",  label: "Beauté",       emoji: "✨" },
  { value: "SPA",     label: "Spa / Bien-être", emoji: "🧖‍♀️" },
  { value: "MASSAGE", label: "Massage",      emoji: "💆‍♀️" },
  { value: "MAKEUP",  label: "Maquillage",   emoji: "💄" },
  { value: "WAXING",  label: "Épilation",    emoji: "🌸" },
  { value: "EYELASH", label: "Cils",         emoji: "👁" },
  { value: "OTHER",   label: "Autre",        emoji: "🏪" },
] as const;

const STEPS = ["Votre salon", "Localisation", "Contacts", "Catégorie"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name:        "",
    address:     "",
    city:        "",
    country:     "SN",
    phone:       "",
    whatsapp:    "",
    email:       "",
    description: "",
    category:    "" as string,
  });

  useEffect(() => {
    const user = getUser();
    if (!user) { router.replace("/login"); return; }
    // Already an owner — skip to dashboard
    if (user.role === "OWNER" || user.role === "STAFF") {
      router.replace("/dashboard");
    }
  }, [router]);

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setError("");
  }

  function validateStep(): string {
    if (step === 0) {
      if (form.name.trim().length < 2) return "Le nom doit contenir au moins 2 caractères.";
    }
    if (step === 1) {
      if (form.address.trim().length < 5) return "Adresse trop courte.";
      if (form.city.trim().length < 2)    return "Ville requise.";
    }
    if (step === 2) {
      if (!form.phone.trim()) return "Numéro de téléphone requis.";
    }
    return "";
  }

  function next() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setStep(s => s + 1);
  }

  async function submit() {
    const err = validateStep();
    if (err) { setError(err); return; }

    setSubmitting(true);
    setError("");

    try {
      const token = getToken();
      const res = await fetch("/api/tenants", {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          name:        form.name.trim(),
          address:     form.address.trim(),
          city:        form.city.trim(),
          country:     form.country,
          phone:       form.phone.trim(),
          whatsapp:    form.whatsapp.trim() || undefined,
          email:       form.email.trim()    || undefined,
          description: form.description.trim() || undefined,
          category:    form.category        || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error?.message ?? "Une erreur s'est produite.");
        return;
      }

      // Update localStorage with fresh JWT + OWNER role
      const { accessToken, user: updatedUser } = json.data;
      const currentUser = getUser();
      if (currentUser && accessToken && updatedUser) {
        setAuth(accessToken, {
          ...currentUser,
          role:     updatedUser.role,
          tenantId: updatedUser.tenantId,
        });
      }

      router.replace("/dashboard");
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--g)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 14px" }}>
            🏪
          </div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
            Créez votre salon
          </h1>
          <p style={{ fontSize: 13, color: "var(--text3)" }}>
            Quelques informations pour commencer
          </p>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {STEPS.map((label, i) => (
            <div key={label} style={{ flex: 1 }}>
              <div style={{
                height: 3,
                borderRadius: 2,
                background: i <= step ? "var(--g1)" : "var(--border2)",
                transition: "background .3s",
                marginBottom: 4,
              }} />
              <div style={{ fontSize: 10, fontWeight: 600, color: i <= step ? "var(--g1)" : "var(--text3)", textAlign: "center", transition: "color .3s" }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px 20px" }}>

          {/* Step 0 — Nom + description */}
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Nom du salon *</label>
                <input
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  placeholder="Ex : Salon Amina"
                  autoFocus
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Description (optionnel)</label>
                <textarea
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  placeholder="Décrivez votre salon en quelques mots…"
                  rows={3}
                  style={{ ...inputStyle, resize: "none" }}
                />
              </div>
            </div>
          )}

          {/* Step 1 — Adresse */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Adresse *</label>
                <input
                  value={form.address}
                  onChange={e => set("address", e.target.value)}
                  placeholder="Ex : 12 Rue Carnot"
                  autoFocus
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Ville *</label>
                <input
                  value={form.city}
                  onChange={e => set("city", e.target.value)}
                  placeholder="Ex : Dakar"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Pays</label>
                <select value={form.country} onChange={e => set("country", e.target.value)} style={inputStyle}>
                  <option value="SN">Sénégal</option>
                  <option value="CI">Côte d&apos;Ivoire</option>
                  <option value="CM">Cameroun</option>
                  <option value="ML">Mali</option>
                  <option value="BF">Burkina Faso</option>
                  <option value="FR">France</option>
                  <option value="BE">Belgique</option>
                  <option value="MA">Maroc</option>
                  <option value="TN">Tunisie</option>
                  <option value="GN">Guinée</option>
                  <option value="TG">Togo</option>
                  <option value="BJ">Bénin</option>
                  <option value="GH">Ghana</option>
                  <option value="NG">Nigeria</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2 — Contacts */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Téléphone *</label>
                <input
                  value={form.phone}
                  onChange={e => set("phone", e.target.value)}
                  placeholder="+221 77 000 00 00"
                  type="tel"
                  autoFocus
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>WhatsApp (optionnel)</label>
                <input
                  value={form.whatsapp}
                  onChange={e => set("whatsapp", e.target.value)}
                  placeholder="+221 77 000 00 00"
                  type="tel"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Email (optionnel)</label>
                <input
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  placeholder="contact@monsalon.com"
                  type="email"
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {/* Step 3 — Catégorie */}
          {step === 3 && (
            <div>
              <label style={{ ...labelStyle, marginBottom: 12, display: "block" }}>Choisissez une catégorie</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    onClick={() => set("category", c.value)}
                    style={{
                      padding: "12px 10px",
                      borderRadius: 10,
                      border: `1px solid ${form.category === c.value ? "var(--g1)" : "var(--border)"}`,
                      background: form.category === c.value ? "rgba(13,158,110,.08)" : "var(--card2)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: ".2s",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{c.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: form.category === c.value ? "var(--g1)" : "var(--text2)" }}>
                      {c.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "rgba(220,38,38,.07)", border: "1px solid rgba(220,38,38,.2)", color: "var(--red)", fontSize: 12 }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            {step > 0 && (
              <button
                onClick={() => { setError(""); setStep(s => s - 1); }}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid var(--border2)", background: "transparent", color: "var(--text2)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                ← Retour
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={next}
                style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none", background: "var(--g)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Continuer →
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none", background: submitting ? "var(--border2)" : "var(--g)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: submitting ? "default" : "pointer" }}
              >
                {submitting ? "Création…" : "Créer mon salon ✓"}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: 11, color: "var(--text3)", marginTop: 20 }}>
          Votre salon sera validé par notre équipe sous 24h.
        </p>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  color: "var(--text3)",
  letterSpacing: ".07em",
  textTransform: "uppercase",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
};
