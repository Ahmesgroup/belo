// /[lang]/legal/gdpr — GDPR rights & procedures.

import type { Metadata } from "next";
import { isValidLang } from "@/lib/i18n-server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l = isValidLang(lang) ? lang : "fr";
  return {
    title:       l === "fr" ? "RGPD | Belo" : "GDPR | Belo",
    description: l === "fr"
      ? "Vos droits RGPD chez Belo : accès, rectification, suppression, portabilité."
      : "Your GDPR rights at Belo: access, rectification, deletion, portability.",
    alternates:  { canonical: `/${l}/legal/gdpr` },
  };
}

const FR = (
  <>
    <h1>RGPD</h1>
    <p className="text-lg" style={{ color: "var(--text2)" }}>
      Le règlement européen sur la protection des données (RGPD) vous accorde
      des droits forts sur vos données personnelles. Chez Belo, ces droits sont
      la norme — pas une option.
    </p>

    <h2>Vos droits</h2>
    <ul>
      <li><strong>Accès</strong> — savoir quelles données nous avons sur vous.</li>
      <li><strong>Rectification</strong> — corriger une information inexacte.</li>
      <li><strong>Suppression</strong> — demander l'effacement de votre compte et données.</li>
      <li><strong>Portabilité</strong> — recevoir une copie de vos données dans un format ouvert.</li>
      <li><strong>Opposition</strong> — refuser certains traitements (marketing, personnalisation).</li>
      <li><strong>Limitation</strong> — geler le traitement le temps d'une vérification.</li>
      <li><strong>Retrait du consentement</strong> — à tout moment, sans justification.</li>
    </ul>

    <h2>Comment exercer vos droits</h2>

    <h3>Depuis votre compte</h3>
    <p>
      La plupart des actions sont disponibles directement dans{" "}
      <strong>Profil → Réglages</strong> :
    </p>
    <ul>
      <li>Modifier vos informations personnelles.</li>
      <li>Retirer le consentement analytique / marketing.</li>
      <li>Demander l'export de vos données (envoyé sous 7 jours).</li>
      <li>Supprimer définitivement votre compte (avec délai de 30 jours pour annulation).</li>
    </ul>

    <h3>Par email</h3>
    <p>
      Si vous préférez écrire :{" "}
      <a href="mailto:privacy@belo.sn">privacy@belo.sn</a>. Joignez une pièce
      d'identité pour vérification (supprimée dès la demande traitée). Nous
      répondons sous 30 jours, prolongeable à 60 jours pour les cas complexes
      avec notification.
    </p>

    <h2>Suppression de compte — ce qui se passe</h2>
    <ul>
      <li>Jour 0 : vous demandez la suppression depuis votre profil ou par email.</li>
      <li>Jour 0 : votre profil devient invisible et inaccessible.</li>
      <li>Jours 0–30 : vous pouvez annuler la suppression depuis l'email reçu.</li>
      <li>Jour 30 : suppression définitive du compte, des préférences, de l'historique de navigation.</li>
      <li>Conservées sous forme anonymisée jusqu'à 5 ans : factures, transactions
        (obligation fiscale), avis publiés (intérêt légitime de l'écosystème).</li>
    </ul>

    <h2>Export de vos données</h2>
    <p>
      Vous recevez par email un fichier JSON contenant :
    </p>
    <ul>
      <li>Vos informations de compte.</li>
      <li>Vos réservations passées et futures.</li>
      <li>Vos préférences et favoris.</li>
      <li>L'historique de vos consentements.</li>
      <li>Métadonnées techniques (dates de connexion).</li>
    </ul>
    <p>
      Le fichier est généré sous 7 jours et téléchargeable pendant 14 jours via
      un lien sécurisé.
    </p>

    <h2>Si vous n'êtes pas satisfait</h2>
    <p>
      Vous pouvez introduire une réclamation auprès de l'autorité de contrôle
      compétente :
    </p>
    <ul>
      <li><strong>France</strong> — CNIL, <a href="https://cnil.fr">cnil.fr</a></li>
      <li><strong>Belgique</strong> — APD/GBA, <a href="https://autoriteprotectiondonnees.be">autoriteprotectiondonnees.be</a></li>
      <li><strong>Luxembourg</strong> — CNPD, <a href="https://cnpd.public.lu">cnpd.public.lu</a></li>
      <li><strong>Sénégal</strong> — CDP, <a href="https://cdp.sn">cdp.sn</a></li>
    </ul>

    <h2>Contact DPO</h2>
    <p>
      Délégué à la protection des données :{" "}
      <a href="mailto:privacy@belo.sn">privacy@belo.sn</a>.
    </p>
  </>
);

const EN = (
  <>
    <h1>GDPR</h1>
    <p className="text-lg" style={{ color: "var(--text2)" }}>
      The European General Data Protection Regulation grants you strong rights
      over your personal data. At Belo, these rights are the standard — not an
      option.
    </p>

    <h2>Your rights</h2>
    <ul>
      <li><strong>Access</strong> — know what data we hold about you.</li>
      <li><strong>Rectification</strong> — correct inaccurate information.</li>
      <li><strong>Erasure</strong> — request deletion of your account and data.</li>
      <li><strong>Portability</strong> — receive a copy in an open format.</li>
      <li><strong>Objection</strong> — refuse certain processing (marketing, personalisation).</li>
      <li><strong>Restriction</strong> — pause processing during verification.</li>
      <li><strong>Consent withdrawal</strong> — at any time, no reason needed.</li>
    </ul>

    <h2>How to exercise your rights</h2>

    <h3>From your account</h3>
    <p>
      Most actions are available directly in{" "}
      <strong>Profile → Settings</strong>:
    </p>
    <ul>
      <li>Edit your personal information.</li>
      <li>Withdraw analytics / marketing consent.</li>
      <li>Request a data export (sent within 7 days).</li>
      <li>Permanently delete your account (30-day cancellation window).</li>
    </ul>

    <h3>By email</h3>
    <p>
      If you prefer to write: <a href="mailto:privacy@belo.sn">privacy@belo.sn</a>.
      Include ID proof for verification (deleted once your request is handled).
      We reply within 30 days, extendable to 60 days for complex cases with
      notification.
    </p>

    <h2>Account deletion — what happens</h2>
    <ul>
      <li>Day 0: you request deletion from your profile or by email.</li>
      <li>Day 0: your profile becomes invisible and inaccessible.</li>
      <li>Days 0–30: you can cancel deletion from the email you received.</li>
      <li>Day 30: account, preferences and browsing history permanently deleted.</li>
      <li>Kept anonymised up to 5 years: invoices, transactions (tax
        obligation), published reviews (legitimate ecosystem interest).</li>
    </ul>

    <h2>Data export</h2>
    <p>You receive a JSON file by email containing:</p>
    <ul>
      <li>Your account information.</li>
      <li>Your past and future bookings.</li>
      <li>Your preferences and favourites.</li>
      <li>Your consent history.</li>
      <li>Technical metadata (login dates).</li>
    </ul>
    <p>
      The file is generated within 7 days and downloadable for 14 days via a
      secure link.
    </p>

    <h2>If you're not satisfied</h2>
    <p>
      You can lodge a complaint with the competent supervisory authority:
    </p>
    <ul>
      <li><strong>France</strong> — CNIL, <a href="https://cnil.fr">cnil.fr</a></li>
      <li><strong>Belgium</strong> — APD/GBA, <a href="https://autoriteprotectiondonnees.be">autoriteprotectiondonnees.be</a></li>
      <li><strong>Luxembourg</strong> — CNPD, <a href="https://cnpd.public.lu">cnpd.public.lu</a></li>
      <li><strong>Senegal</strong> — CDP, <a href="https://cdp.sn">cdp.sn</a></li>
    </ul>

    <h2>DPO contact</h2>
    <p>
      Data Protection Officer:{" "}
      <a href="mailto:privacy@belo.sn">privacy@belo.sn</a>.
    </p>
  </>
);

export default async function GdprPage({ params }: Props) {
  const { lang } = await params;
  const l = isValidLang(lang) ? lang : "fr";
  return l === "fr" ? FR : EN;
}
