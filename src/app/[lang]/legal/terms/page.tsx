// /[lang]/legal/terms — Terms of service.

import type { Metadata } from "next";
import { isValidLang } from "@/lib/i18n-server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l = isValidLang(lang) ? lang : "fr";
  return {
    title:       l === "fr" ? "Conditions | Belo" : "Terms | Belo",
    description: l === "fr"
      ? "Conditions d'utilisation de la plateforme Belo — claires et lisibles."
      : "Belo platform terms of use — clear and readable.",
    alternates:  { canonical: `/${l}/legal/terms` },
  };
}

const FR = (
  <>
    <h1>Conditions</h1>
    <p className="text-lg" style={{ color: "var(--text2)" }}>
      Belo est une place de marché entre des salons de beauté et leurs clientes.
      Voici les règles, expliquées simplement.
    </p>

    <h2>Acceptation</h2>
    <p>
      En créant un compte ou en réservant via Belo, vous acceptez ces conditions.
      Si quelque chose vous semble flou, écrivez-nous — nous le clarifions.
    </p>

    <h2>Ce que Belo fait, et ne fait pas</h2>
    <p>
      Belo met en relation des clientes et des salons. Nous gérons la prise de
      réservation, les notifications, et le paiement éventuel d'un acompte. Nous
      ne sommes pas le prestataire des soins — c'est le salon qui exécute la
      prestation, sous sa propre responsabilité professionnelle.
    </p>

    <h2>Compte client</h2>
    <ul>
      <li>Vous devez avoir au moins 18 ans, ou l'accord d'un parent.</li>
      <li>Vos informations doivent être exactes (numéro WhatsApp en particulier).</li>
      <li>Un seul compte par personne.</li>
      <li>Vous pouvez supprimer votre compte à tout moment depuis votre profil.</li>
    </ul>

    <h2>Compte gérant de salon</h2>
    <ul>
      <li>Vous garantissez disposer des autorisations légales pour exercer.</li>
      <li>Vous respectez les horaires et prestations affichés.</li>
      <li>Vous traitez chaque cliente avec respect et hygiène professionnelle.</li>
      <li>Vous êtes responsable des données clients que vous voyez via Belo —
        elles ne doivent jamais être utilisées hors de Belo sans consentement.</li>
      <li>Belo peut suspendre votre compte en cas de plaintes répétées ou de
        fraude. La procédure est expliquée par email avant toute action.</li>
    </ul>

    <h2>Réservations</h2>
    <ul>
      <li>Une réservation devient ferme lorsqu'elle est confirmée par le salon.</li>
      <li>L'acompte éventuel est crédité au gérant via Stripe Connect après la
        confirmation de prestation.</li>
      <li>Annulation gratuite jusqu'à 2 heures avant le rendez-vous. Au-delà,
        l'acompte peut être retenu selon la politique du salon.</li>
      <li>Le no-show répété peut entraîner la limitation temporaire du compte.</li>
    </ul>

    <h2>Paiements</h2>
    <p>
      Les paiements transitent par Stripe (cartes), Wave et Orange Money (mobile
      money). Belo prélève une commission de plateforme, indiquée au moment du
      paiement. Aucune donnée bancaire n'est jamais visible ou stockée par Belo.
    </p>

    <h2>Propriété intellectuelle</h2>
    <p>
      Le nom Belo, son logo, son site et son code sont la propriété de Belo. Les
      photos que vous publiez restent à vous — vous nous donnez seulement le
      droit de les afficher sur votre profil salon tant que votre compte est
      actif.
    </p>

    <h2>Responsabilité</h2>
    <p>
      Belo s'efforce de garantir la disponibilité du service, sans pouvoir
      garantir l'absence totale d'interruption. Nous ne sommes pas responsables
      des prestations exécutées en salon — adressez-vous au salon en premier
      lieu. Si un litige persiste, écrivez-nous : nous interviendrons en
      médiateur dans la mesure du possible.
    </p>

    <h2>Droit applicable</h2>
    <p>
      Pour les clientes au Sénégal et les salons sénégalais : droit sénégalais,
      tribunaux de Dakar. Pour les utilisateurs européens : droit du pays de
      résidence, conformément au règlement Rome I et à la directive consommateur.
    </p>

    <h2>Mises à jour</h2>
    <p>
      Nous pouvons faire évoluer ces conditions. Toute modification matérielle
      est notifiée par email 30 jours à l'avance. Continuer à utiliser Belo
      après cette date vaut acceptation.
    </p>
  </>
);

const EN = (
  <>
    <h1>Terms</h1>
    <p className="text-lg" style={{ color: "var(--text2)" }}>
      Belo is a marketplace between beauty salons and their clients. Here are
      the rules, explained simply.
    </p>

    <h2>Acceptance</h2>
    <p>
      By creating an account or booking via Belo, you accept these terms. If
      anything feels unclear, write to us — we'll clarify.
    </p>

    <h2>What Belo does, and doesn't do</h2>
    <p>
      Belo connects clients and salons. We handle booking, notifications, and
      optional deposit payment. We are NOT the service provider — the salon
      delivers the treatment under its own professional responsibility.
    </p>

    <h2>Client account</h2>
    <ul>
      <li>You must be at least 18, or have a parent's consent.</li>
      <li>Your information must be accurate (especially WhatsApp number).</li>
      <li>One account per person.</li>
      <li>You can delete your account at any time from your profile.</li>
    </ul>

    <h2>Salon owner account</h2>
    <ul>
      <li>You guarantee that you hold the legal authorisations to operate.</li>
      <li>You honour the hours and services displayed.</li>
      <li>You treat each client with respect and professional hygiene.</li>
      <li>You are responsible for the client data you see via Belo — it must
        never be used outside Belo without consent.</li>
      <li>Belo may suspend your account in case of repeated complaints or
        fraud. The procedure is explained by email before any action.</li>
    </ul>

    <h2>Bookings</h2>
    <ul>
      <li>A booking is firm when confirmed by the salon.</li>
      <li>Any deposit is credited to the salon owner via Stripe Connect after
        service confirmation.</li>
      <li>Free cancellation up to 2 hours before the appointment. After that,
        the deposit may be withheld depending on the salon's policy.</li>
      <li>Repeated no-shows may result in temporary account limitation.</li>
    </ul>

    <h2>Payments</h2>
    <p>
      Payments are processed by Stripe (cards), Wave and Orange Money (mobile
      money). Belo takes a platform commission, displayed at the moment of
      payment. No card data is ever visible to or stored by Belo.
    </p>

    <h2>Intellectual property</h2>
    <p>
      The Belo name, logo, site, and code are owned by Belo. The photos you
      upload remain yours — you simply grant us the right to display them on
      your salon profile while your account is active.
    </p>

    <h2>Liability</h2>
    <p>
      Belo strives to keep the service available, without guaranteeing zero
      interruption. We are not responsible for treatments performed in salon —
      contact the salon first. If a dispute persists, write to us: we will
      mediate when possible.
    </p>

    <h2>Governing law</h2>
    <p>
      For clients in Senegal and Senegalese salons: Senegalese law, courts of
      Dakar. For European users: the law of country of residence, in
      accordance with Rome I and consumer directives.
    </p>

    <h2>Updates</h2>
    <p>
      We may update these terms. Any material change is notified by email 30
      days in advance. Continued use after that date constitutes acceptance.
    </p>
  </>
);

export default async function TermsPage({ params }: Props) {
  const { lang } = await params;
  const l = isValidLang(lang) ? lang : "fr";
  return l === "fr" ? FR : EN;
}
