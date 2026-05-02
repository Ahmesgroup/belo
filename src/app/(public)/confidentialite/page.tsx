import { PublicNav } from "@/components/ui/Nav";
import Link from "next/link";

export const metadata = { title: "Confidentialité" };

export default function ConfidentialitePage() {
  return (
    <>
      <PublicNav />
      <main style={{paddingTop:56}}>
        <div style={{maxWidth:700,margin:"0 auto",padding:"40px 5vw 80px"}}>
          <h1 style={{fontFamily:"var(--serif)",fontSize:28,fontWeight:800,marginBottom:8}}>
            Politique de confidentialité
          </h1>
          <p style={{color:"var(--text3)",fontSize:13,marginBottom:32}}>Dernière mise à jour : mai 2026</p>

          {[
            { title:"1. Données collectées", body:"Nous collectons votre numéro de téléphone WhatsApp lors de l'inscription, utilisé uniquement pour vous envoyer des confirmations de réservation et des notifications de service. Aucune donnée sensible (carte bancaire, pièce d'identité) n'est stockée sur nos serveurs." },
            { title:"2. Utilisation des données", body:"Vos données sont utilisées pour : gérer vos réservations, envoyer des confirmations WhatsApp, améliorer notre service. Nous ne vendons jamais vos données à des tiers." },
            { title:"3. Conservation", body:"Vos données sont conservées pendant 2 ans après votre dernière activité, puis supprimées automatiquement. Vous pouvez demander la suppression immédiate de votre compte depuis votre profil." },
            { title:"4. Vos droits (RGPD)", body:"Vous avez le droit d'accéder, corriger ou supprimer vos données personnelles. Pour exercer ces droits, contactez-nous à contact@belo.sn. Nous répondons sous 72 heures." },
            { title:"5. Cookies", body:"Belo n'utilise pas de cookies publicitaires. Seuls des cookies fonctionnels essentiels au bon fonctionnement du service sont utilisés (session, préférences)." },
            { title:"6. Contact", body:"Pour toute question relative à la confidentialité de vos données : contact@belo.sn — Belo, Dakar, Sénégal." },
          ].map(s => (
            <div key={s.title} style={{marginBottom:28}}>
              <h2 style={{fontFamily:"var(--serif)",fontSize:16,fontWeight:700,marginBottom:8}}>{s.title}</h2>
              <p style={{fontSize:13,color:"var(--text2)",lineHeight:1.7}}>{s.body}</p>
            </div>
          ))}

          <div style={{marginTop:32,paddingTop:20,borderTop:"1px solid var(--border)"}}>
            <Link href="/" style={{fontSize:13,color:"var(--g2)",textDecoration:"none"}}>← Retour à l'accueil</Link>
          </div>
        </div>
      </main>
    </>
  );
}
