"use client";

import { useState, useEffect } from "react";

interface Consent {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  savedAt:   number;
}

const KEY = "belo_cookie_consent";

export default function CookieBanner() {
  const [visible,   setVisible]   = useState(false);
  const [expanded,  setExpanded]  = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) { setVisible(true); return; }
      const saved = JSON.parse(raw) as Consent;
      // Re-show if consent is older than 13 months (GDPR requirement)
      const expired = Date.now() - saved.savedAt > 13 * 30 * 24 * 60 * 60 * 1000;
      if (expired) { setVisible(true); localStorage.removeItem(KEY); }
    } catch {
      setVisible(true);
    }
  }, []);

  function save(c: Omit<Consent, "savedAt">) {
    const full: Consent = { ...c, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(full));
    // Also set a non-httpOnly cookie readable by the server for SSR consent
    document.cookie = `belo_consent=${encodeURIComponent(JSON.stringify({ analytics: c.analytics, marketing: c.marketing }))};path=/;max-age=${13 * 30 * 24 * 3600};SameSite=Lax`;
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Préférences de cookies"
      className="
        fixed bottom-0 left-0 right-0 z-[9999]
        bg-card border-t border-border2 shadow-[0_-8px_40px_rgba(0,0,0,.18)]
        animate-[slideUp_.3s_ease]
      "
    >
      <div className="max-w-5xl mx-auto px-5 py-5">
        <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text mb-1">🍪 Ce site utilise des cookies</p>
            <p className="text-xs text-text3 leading-relaxed">
              Les cookies essentiels assurent le fonctionnement du site.{" "}
              {expanded ? null : (
                <a href="/confidentialite" className="text-g2 hover:underline">En savoir plus</a>
              )}
            </p>

            {expanded && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                {[
                  {
                    key:      "essential",
                    label:    "Essentiels",
                    desc:     "Authentification, sécurité, session. Toujours actifs.",
                    checked:  true,
                    disabled: true,
                    onChange: () => {},
                  },
                  {
                    key:      "analytics",
                    label:    "Analytiques",
                    desc:     "Mesure d'audience anonyme (aucune donnée personnelle).",
                    checked:  analytics,
                    disabled: false,
                    onChange: setAnalytics,
                  },
                  {
                    key:      "marketing",
                    label:    "Marketing",
                    desc:     "Publicités personnalisées sur nos partenaires.",
                    checked:  marketing,
                    disabled: false,
                    onChange: setMarketing,
                  },
                ].map(item => (
                  <label key={item.key} className={`flex items-start gap-3 ${item.disabled ? "cursor-default" : "cursor-pointer"}`}>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      disabled={item.disabled}
                      onChange={e => item.onChange(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-g1 shrink-0"
                    />
                    <div>
                      <span className="text-sm font-semibold text-text">
                        {item.label}
                        {item.disabled && <span className="ml-1 text-[10px] text-text3">(requis)</span>}
                      </span>
                      <p className="text-xs text-text3">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="px-4 py-2 rounded-xl border border-border2 text-text3 text-xs font-semibold hover:bg-card2 transition-colors"
            >
              {expanded ? "Masquer" : "Personnaliser"}
            </button>

            {expanded && (
              <button
                type="button"
                onClick={() => save({ essential: true, analytics, marketing })}
                className="px-4 py-2 rounded-xl border border-border2 bg-card2 text-text2 text-xs font-semibold hover:bg-card transition-colors"
              >
                Enregistrer
              </button>
            )}

            <button
              type="button"
              onClick={() => save({ essential: true, analytics: false, marketing: false })}
              className="px-4 py-2 rounded-xl border border-border2 text-text3 text-xs font-semibold hover:bg-card2 transition-colors"
            >
              Refuser
            </button>

            <button
              type="button"
              onClick={() => save({ essential: true, analytics: true, marketing: true })}
              className="px-5 py-2 rounded-xl bg-g1 text-white text-xs font-bold hover:bg-g3 transition-colors shadow-green"
            >
              Tout accepter
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}
