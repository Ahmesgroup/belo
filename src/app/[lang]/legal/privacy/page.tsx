// /[lang]/legal/privacy — Privacy policy, editorial reading.

import type { Metadata } from "next";
import { isValidLang } from "@/lib/i18n-server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l = isValidLang(lang) ? lang : "fr";
  return {
    title:       l === "fr" ? "Confidentialité | Belo" : "Privacy | Belo",
    description: l === "fr"
      ? "Comment Belo collecte, utilise et protège vos données personnelles."
      : "How Belo collects, uses and protects your personal data.",
    alternates:  { canonical: `/${l}/legal/privacy` },
  };
}

const FR = (
  <>
    <h1>Confidentialité</h1>
    <p className="text-lg" style={{ color: "var(--text2)" }}>
      Nous traitons vos données avec le même soin qu'un salon traite votre peau —
      avec attention, transparence et le minimum nécessaire.
    </p>

    <h2>Ce que nous collectons</h2>
    <p>Selon la façon dont vous utilisez Belo :</p>
    <ul>
      <li><strong>Compte</strong> : votre nom, numéro WhatsApp, adresse email si fournie.</li>
      <li><strong>Réservation</strong> : salon choisi, prestation, date/heure, notes éventuelles, statut de paiement.</li>
      <li><strong>Paiement</strong> : nous ne stockons jamais le numéro de carte — il transite directement par Stripe ou Wave/Orange Money. Nous conservons une référence de transaction.</li>
      <li><strong>Navigation</strong> : pages vues et clics agrégés, uniquement si vous acceptez les cookies analytiques.</li>
      <li><strong>Position</strong> : seulement si vous l'autorisez explicitement pour la recherche "près de moi".</li>
    </ul>

    <h2>Pourquoi nous traitons ces données</h2>
    <ul>
      <li><strong>Exécution du contrat</strong> — créer votre compte, gérer vos réservations, vous envoyer les confirmations WhatsApp.</li>
      <li><strong>Obligation légale</strong> — conserver les preuves de transaction (facturation, fiscalité).</li>
      <li><strong>Intérêt légitime</strong> — sécurité, prévention de la fraude, amélioration du produit.</li>
      <li><strong>Consentement</strong> — analytique, communications marketing, recommandations personnalisées.</li>
    </ul>

    <h2>Qui voit vos données</h2>
    <ul>
      <li>Le salon que vous réservez (nom, numéro WhatsApp, prestation et créneau réservé).</li>
      <li>Nos prestataires techniques : Stripe (paiement), Wave / Orange Money (paiement), Cloudflare R2 (stockage des photos), Neon (base de données EU/US), Upstash (cache), Meta WhatsApp Cloud API (notifications).</li>
      <li>Les autorités, uniquement sur demande légale formelle.</li>
    </ul>
    <p>Vos données ne sont jamais vendues à des tiers.</p>

    <h2>Durées de conservation</h2>
    <ul>
      <li><strong>Compte actif</strong> : tant que vous l'utilisez.</li>
      <li><strong>Compte inactif</strong> : suppression automatique après 24 mois sans activité, avec notification 30 jours avant.</li>
      <li><strong>Réservations</strong> : 5 ans pour les obligations fiscales et de preuve.</li>
      <li><strong>Logs techniques</strong> : 90 jours maximum.</li>
      <li><strong>Communications marketing</strong> : jusqu'au retrait du consentement.</li>
    </ul>

    <h2>Vos droits</h2>
    <p>
      Sous le RGPD vous pouvez à tout moment accéder, rectifier, supprimer ou exporter vos
      données. Voir la <a href="/fr/legal/gdpr">page RGPD</a> pour le détail des procédures.
    </p>

    <h2>Contact</h2>
    <p>
      Délégué à la protection des données :{" "}
      <a href="mailto:privacy@belo.sn">privacy@belo.sn</a>.
      Réponse sous 30 jours maximum.
    </p>
  </>
);

const EN = (
  <>
    <h1>Privacy</h1>
    <p className="text-lg" style={{ color: "var(--text2)" }}>
      We handle your data with the same care a salon gives your skin — with
      attention, transparency, and the minimum necessary.
    </p>

    <h2>What we collect</h2>
    <p>Depending on how you use Belo:</p>
    <ul>
      <li><strong>Account</strong>: name, WhatsApp number, email if provided.</li>
      <li><strong>Booking</strong>: salon chosen, service, date/time, optional notes, payment status.</li>
      <li><strong>Payment</strong>: we never store card numbers — they go directly through Stripe or Wave/Orange Money. We keep a transaction reference.</li>
      <li><strong>Navigation</strong>: aggregated page views and clicks, only with your analytics-cookies consent.</li>
      <li><strong>Location</strong>: only with explicit permission for "near me" search.</li>
    </ul>

    <h2>Why we process this data</h2>
    <ul>
      <li><strong>Contract execution</strong> — creating your account, managing bookings, sending WhatsApp confirmations.</li>
      <li><strong>Legal obligation</strong> — keeping transaction proofs (invoicing, tax).</li>
      <li><strong>Legitimate interest</strong> — security, fraud prevention, product improvement.</li>
      <li><strong>Consent</strong> — analytics, marketing, personalised recommendations.</li>
    </ul>

    <h2>Who sees your data</h2>
    <ul>
      <li>The salon you book (name, WhatsApp number, booked service and slot).</li>
      <li>Our technical providers: Stripe (payment), Wave / Orange Money (payment), Cloudflare R2 (photo storage), Neon (database EU/US), Upstash (cache), Meta WhatsApp Cloud API (notifications).</li>
      <li>Authorities, only upon formal legal request.</li>
    </ul>
    <p>Your data is never sold to third parties.</p>

    <h2>Retention periods</h2>
    <ul>
      <li><strong>Active account</strong>: as long as you use it.</li>
      <li><strong>Inactive account</strong>: automatic deletion after 24 months without activity, with 30-day prior notice.</li>
      <li><strong>Bookings</strong>: 5 years for tax and evidentiary obligations.</li>
      <li><strong>Technical logs</strong>: 90 days maximum.</li>
      <li><strong>Marketing communications</strong>: until consent withdrawal.</li>
    </ul>

    <h2>Your rights</h2>
    <p>
      Under GDPR you can at any time access, rectify, delete or export your data.
      See the <a href="/en/legal/gdpr">GDPR page</a> for procedural details.
    </p>

    <h2>Contact</h2>
    <p>
      Data Protection Officer:{" "}
      <a href="mailto:privacy@belo.sn">privacy@belo.sn</a>.
      Response within 30 days maximum.
    </p>
  </>
);

export default async function PrivacyPage({ params }: Props) {
  const { lang } = await params;
  const l = isValidLang(lang) ? lang : "fr";
  return l === "fr" ? FR : EN;
}
