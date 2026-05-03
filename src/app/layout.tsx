import type { Metadata } from "next";
import "./globals.css";
import ThemeInit from "@/components/ThemeInit";
import { LangProvider } from "@/lib/lang-context";

export const metadata: Metadata = {
  title: { default: "Belo — La beauté réservée en 45 secondes", template: "%s | Belo" },
  description: "Réservez les meilleurs salons de beauté au Sénégal. Wave · Orange Money · WhatsApp.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  manifest: "/manifest.json",
  keywords: ["salon", "beauté", "coiffure", "Dakar", "Sénégal", "réservation"],
  openGraph: {
    title: "Belo — La beauté réservée en 45 secondes",
    description: "Réservez les meilleurs salons de beauté au Sénégal.",
    locale: "fr_SN",
    type: "website",
  },
};

/**
 * Root layout — server component.
 *
 * suppressHydrationWarning on <html> is intentional: ThemeInit adds
 * data-theme client-side after hydration, so the attribute value differs
 * between server and client render. suppressHydrationWarning silences that
 * single expected mismatch without hiding real bugs elsewhere.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        {/* Applies the persisted dark/light preference after hydration */}
        <ThemeInit />
        {/* Single source of truth for language state across the whole app */}
        <LangProvider>
          {children}
        </LangProvider>
      </body>
    </html>
  );
}
