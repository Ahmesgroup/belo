"use client";
import Link from "next/link";
import { PublicNav } from "@/components/ui/Nav";

const BENEFITS = [
  {
    icon: "📅",
    title: "Réservations automatiques 24/7",
    desc: "Vos clients réservent en ligne à toute heure. Fini les appels manqués et les carnets perdus.",
  },
  {
    icon: "💰",
    title: "Paiements Wave / Orange Money",
    desc: "Acceptez les paiements mobiles directement sur votre profil Belo. Aucun terminal requis.",
  },
  {
    icon: "🎉",
    title: "0% commission sur les réservations",
    desc: "Gardez 100% de vos revenus. Belo se rémunère uniquement sur l'abonnement mensuel.",
  },
];

const STEPS = [
  { n: "1", label: "Créez votre compte en 2 min" },
  { n: "2", label: "Ajoutez vos services et horaires" },
  { n: "3", label: "Partagez votre lien — les clients réservent" },
];

export default function PourLesSalonsPage() {
  return (
    <>
      <PublicNav />
      <main style={{ paddingTop: 56 }}>
        {/* Hero */}
        <section style={{ padding: "72px 5vw 60px", maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(34,211,138,.08)", border: "1px solid rgba(34,211,138,.18)", color: "var(--g2)", fontSize: 11, fontWeight: 600, padding: "5px 14px", borderRadius: 99, marginBottom: 24, letterSpacing: ".06em" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--g2)", animation: "pulse 2s infinite" }} />
            ✦ Pour les gérants de salon
          </div>

          <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(30px,5vw,56px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.03em", marginBottom: 16 }}>
            Rejoignez Belo —<br />
            <span style={{ color: "var(--g2)", fontStyle: "italic" }}>Gratuit pour commencer</span>
          </h1>

          <p style={{ fontSize: 16, color: "var(--text2)", lineHeight: 1.7, maxWidth: 520, margin: "0 auto 40px" }}>
            Recevez vos réservations en ligne en quelques minutes. Aucune compétence technique requise.
          </p>

          <Link
            href="/login"
            style={{ display: "inline-block", padding: "16px 36px", borderRadius: 14, background: "var(--g)", color: "#fff", fontFamily: "var(--serif)", fontSize: 16, fontWeight: 700, textDecoration: "none", letterSpacing: "-.01em" }}
          >
            Créer mon salon gratuitement →
          </Link>
          <p style={{ marginTop: 14, fontSize: 12, color: "var(--text3)" }}>
            Gratuit · Pas de carte bancaire requise · Actif en 5 minutes
          </p>
        </section>

        {/* Benefits */}
        <section style={{ padding: "0 5vw 64px", maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
            {BENEFITS.map(b => (
              <div key={b.title} style={{ background: "var(--card)", border: "1px solid var(--border2)", borderRadius: 16, padding: 28 }}>
                <div style={{ fontSize: 36, marginBottom: 14 }}>{b.icon}</div>
                <div style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: 16, marginBottom: 10, color: "var(--text)" }}>{b.title}</div>
                <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.6 }}>{b.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section style={{ padding: "48px 5vw 72px", background: "rgba(11,15,22,.4)", borderTop: "1px solid var(--border)" }}>
          <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(22px,4vw,36px)", fontWeight: 800, marginBottom: 10 }}>
              Actif en <span style={{ color: "var(--g2)" }}>3 étapes</span>
            </h2>
            <p style={{ color: "var(--text3)", fontSize: 14, marginBottom: 40 }}>Pas de formation. Pas d'intégration complexe.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {STEPS.map(s => (
                <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 24px", textAlign: "left" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--g)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{s.n}</div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ padding: "64px 5vw", textAlign: "center" }}>
          <div style={{ maxWidth: 540, margin: "0 auto", background: "var(--card)", border: "1px solid var(--border2)", borderRadius: 24, padding: "52px 36px" }}>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(22px,4vw,36px)", fontWeight: 800, marginBottom: 10 }}>
              Prêt à <span style={{ color: "var(--g2)", fontStyle: "italic" }}>démarrer ?</span>
            </h2>
            <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 28 }}>
              Rejoignez les salons qui reçoivent déjà des réservations en automatique.
            </p>
            <Link
              href="/login"
              style={{ display: "inline-block", padding: "14px 32px", borderRadius: 12, background: "var(--g)", color: "#fff", fontFamily: "var(--serif)", fontSize: 15, fontWeight: 700, textDecoration: "none" }}
            >
              Créer mon salon gratuitement →
            </Link>
            <p style={{ marginTop: 16, fontSize: 11, color: "var(--text3)" }}>
              Gratuit · Aucune carte requise · Actif en 5 minutes
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
