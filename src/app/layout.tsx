import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Belo — La beauté réservée en 45 secondes", template: "%s | Belo" },
  description: "Réservez les meilleurs salons de beauté au Sénégal. Wave · Orange Money · WhatsApp.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  keywords: ["salon", "beauté", "coiffure", "Dakar", "Sénégal", "réservation"],
  openGraph: {
    title: "Belo — La beauté réservée en 45 secondes",
    description: "Réservez les meilleurs salons de beauté au Sénégal.",
    locale: "fr_SN",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
