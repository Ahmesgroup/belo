// /[lang]/legal/cookies — Cookie policy.

import type { Metadata } from "next";
import { isValidLang } from "@/lib/i18n-server";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l = isValidLang(lang) ? lang : "fr";
  return {
    title:       l === "fr" ? "Cookies | Belo" : "Cookies | Belo",
    description: l === "fr"
      ? "Ce que Belo stocke sur votre appareil, et pourquoi."
      : "What Belo stores on your device, and why.",
    alternates:  { canonical: `/${l}/legal/cookies` },
  };
}

const FR = (
  <>
    <h1>Cookies</h1>
    <p className="text-lg" style={{ color: "var(--text2)" }}>
      Quelques fichiers minuscules sur votre appareil — choisis avec parcimonie,
      jamais utilisés pour vous suivre à travers le web.
    </p>

    <h2>Trois catégories, trois consentements</h2>
    <p>
      Belo distingue strictement les cookies essentiels (toujours actifs) des
      cookies optionnels (analytique, personnalisation). Vous donnez ou retirez
      votre consentement à tout moment depuis le bandeau cookies.
    </p>

    <h2>Cookies essentiels — toujours actifs</h2>
    <p>Indispensables au fonctionnement du service. Sans eux, vous ne pouvez ni vous connecter ni réserver.</p>
    <ul>
      <li><strong>belo_token</strong> — votre session de connexion (7 jours).</li>
      <li><strong>belo_user</strong> — votre profil local (cache 24h).</li>
      <li><strong>belo_lang</strong> — votre choix de langue (1 an).</li>
      <li><strong>belo_theme</strong> — votre mode sombre / clair (1 an).</li>
      <li><strong>belo_consent</strong> — votre choix sur ce bandeau lui-même (1 an).</li>
    </ul>

    <h2>Cookies analytiques — opt-in</h2>
    <p>
      Si vous acceptez, nous mesurons de façon agrégée et anonymisée comment Belo
      est utilisé : pages vues, temps de chargement, parcours de réservation.
      Aucun pistage publicitaire, aucune revente de données.
    </p>
    <ul>
      <li>Provider : interne (Belo Events), pas de Google Analytics.</li>
      <li>Donnée stockée : un identifiant aléatoire de session, 24 mois max.</li>
    </ul>

    <h2>Cookies de personnalisation — opt-in</h2>
    <p>
      Si vous acceptez, nous adaptons vos recommandations de salons à votre
      historique. Sinon, vous voyez les mêmes résultats que tout le monde —
      également pertinents, simplement non personnalisés.
    </p>
    <ul>
      <li>Donnée stockée : favoris, catégories vues, ville préférée.</li>
      <li>Durée : 12 mois ou jusqu'à révocation.</li>
    </ul>

    <h2>Cookies tiers</h2>
    <p>
      Belo n'utilise <strong>aucun</strong> cookie de réseau publicitaire (Meta,
      Google Ads, etc.). Les seuls services tiers que vous rencontrerez via Belo
      sont les paiements (Stripe, Wave, Orange Money) — uniquement au moment du
      paiement, jamais en navigation.
    </p>

    <h2>Modifier votre choix</h2>
    <p>
      Cliquez sur "Cookies" dans le pied de page à tout moment, ou supprimez{" "}
      <code>belo_consent</code> dans votre navigateur pour revoir le bandeau.
    </p>
  </>
);

const EN = (
  <>
    <h1>Cookies</h1>
    <p className="text-lg" style={{ color: "var(--text2)" }}>
      A few tiny files on your device — chosen sparingly, never used to track
      you across the web.
    </p>

    <h2>Three categories, three consents</h2>
    <p>
      Belo strictly separates essential cookies (always on) from optional ones
      (analytics, personalisation). You grant or withdraw consent at any time
      from the cookie banner.
    </p>

    <h2>Essential cookies — always on</h2>
    <p>Required for the service to work. Without them, you cannot log in or book.</p>
    <ul>
      <li><strong>belo_token</strong> — your login session (7 days).</li>
      <li><strong>belo_user</strong> — your local profile (24h cache).</li>
      <li><strong>belo_lang</strong> — your language choice (1 year).</li>
      <li><strong>belo_theme</strong> — dark / light preference (1 year).</li>
      <li><strong>belo_consent</strong> — your choice on this banner itself (1 year).</li>
    </ul>

    <h2>Analytics cookies — opt-in</h2>
    <p>
      If you accept, we measure aggregated and anonymised usage: page views,
      load times, booking funnels. No ad tracking, no data reselling.
    </p>
    <ul>
      <li>Provider: internal (Belo Events), no Google Analytics.</li>
      <li>Data stored: a random session identifier, 24 months max.</li>
    </ul>

    <h2>Personalisation cookies — opt-in</h2>
    <p>
      If you accept, we adapt salon recommendations to your history. Otherwise,
      you see the same results as everyone else — equally relevant, just not
      personalised.
    </p>
    <ul>
      <li>Data stored: favourites, viewed categories, preferred city.</li>
      <li>Duration: 12 months or until revocation.</li>
    </ul>

    <h2>Third-party cookies</h2>
    <p>
      Belo uses <strong>no</strong> advertising network cookies (Meta, Google
      Ads, etc.). The only third-party services you'll meet via Belo are
      payments (Stripe, Wave, Orange Money) — only at the moment of payment,
      never during browsing.
    </p>

    <h2>Change your choice</h2>
    <p>
      Click "Cookies" in the footer at any time, or delete{" "}
      <code>belo_consent</code> in your browser to see the banner again.
    </p>
  </>
);

export default async function CookiesPage({ params }: Props) {
  const { lang } = await params;
  const l = isValidLang(lang) ? lang : "fr";
  return l === "fr" ? FR : EN;
}
