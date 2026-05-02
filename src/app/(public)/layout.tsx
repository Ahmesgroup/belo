import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default:  "Belo — Réservez votre salon en 45 secondes",
    template: "%s | Belo",
  },
  description:
    "Trouvez et réservez les meilleurs salons de coiffure, beauté et bien-être à Dakar. Paiement Wave ou Orange Money. Confirmation WhatsApp instantanée.",
  openGraph: {
    type:        "website",
    locale:      "fr_SN",
    url:         "https://belo-khaki.vercel.app",
    siteName:    "Belo",
    title:       "Belo — La beauté réservée en 45 secondes",
    description: "Réservez les meilleurs salons de Dakar. Wave, Orange Money. Confirmation WhatsApp.",
  },
  twitter: {
    card:        "summary_large_image",
    title:       "Belo — La beauté réservée en 45 secondes",
    description: "Réservez les meilleurs salons de Dakar en 45 secondes.",
  },
  robots: { index: true, follow: true },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
