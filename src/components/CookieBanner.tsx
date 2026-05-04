"use client";

import { useState, useEffect } from "react";

type Consent = {
  essential:  true;
  analytics:  boolean;
  marketing:  boolean;
};

const STORAGE_KEY = "belo_cookie_consent";

export default function CookieBanner() {
  const [visible,   setVisible]   = useState(false);
  const [expanded,  setExpanded]  = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function save(consent: Consent) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch { /* ignore */ }
    setVisible(false);
  }

  function acceptAll() {
    save({ essential: true, analytics: true, marketing: true });
  }

  function rejectAll() {
    save({ essential: true, analytics: false, marketing: false });
  }

  function saveCustom() {
    save({ essential: true, analytics, marketing });
  }

  if (!visible) return null;

  return (
    <div role="dialog" aria-label="Préférences cookies" style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9000,
      background: "var(--card)", borderTop: "1px solid var(--border2)",
      padding: "16px 20px", boxShadow: "0 -8px 32px rgba(0,0,0,.3)",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 5 }}>🍪 Ce site utilise des cookies</div>
            <p style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.5, margin: 0 }}>
              Nous utilisons des cookies essentiels pour le fonctionnement du site. Avec votre accord, nous utilisons des cookies analytiques pour améliorer notre service.{" "}
              <a href="/confidentialite" style={{ color: "var(--g2)", textDecoration: "none" }}>En savoir plus</a>
            </p>
            {expanded && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { key: "essential", label: "Essentiels", desc: "Authentification, panier, sécurité. Toujours actifs.", value: true,      disabled: true, onChange: () => {} },
                  { key: "analytics", label: "Analytiques", desc: "Mesure d'audience anonyme pour améliorer le service.", value: analytics, disabled: false, onChange: (v: boolean) => setAnalytics(v) },
                  { key: "marketing", label: "Marketing",   desc: "Publicités personnalisées sur nos partenaires.",        value: marketing, disabled: false, onChange: (v: boolean) => setMarketing(v) },
                ].map(item => (
                  <label key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: item.disabled ? "default" : "pointer" }}>
                    <input type="checkbox" checked={item.value} disabled={item.disabled} onChange={e => item.onChange(e.target.checked)}
                      style={{ marginTop: 2, accentColor: "var(--g2)", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{item.label} {item.disabled && <span style={{ fontSize: 10, color: "var(--text3)" }}>(requis)</span>}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={() => setExpanded(!expanded)}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border2)", background: "transparent", color: "var(--text3)", fontSize: 11, cursor: "pointer" }}>
              {expanded ? "Masquer" : "Personnaliser"}
            </button>
            {expanded && (
              <button type="button" onClick={saveCustom}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border2)", background: "var(--card2)", color: "var(--text2)", fontSize: 11, cursor: "pointer" }}>
                Enregistrer
              </button>
            )}
            <button type="button" onClick={rejectAll}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border2)", background: "transparent", color: "var(--text3)", fontSize: 11, cursor: "pointer" }}>
              Refuser
            </button>
            <button type="button" onClick={acceptAll}
              style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--g)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Tout accepter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
