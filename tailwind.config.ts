import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["DM Sans",          "sans-serif"],
        serif:   ["Sora",             "sans-serif"],
        mono:    ["JetBrains Mono",   "monospace"],
        // next/font CSS variable fonts — loaded in src/app/fonts.ts
        heading: ["var(--font-fraunces)", "Georgia", "serif"],
        body:    ["var(--font-dm)",       "DM Sans", "sans-serif"],
      },
      // CSS-variable–based palette — responds to [data-theme="dark"]
      colors: {
        // ── INTENT SYSTEM — seule source de vérité couleur ──────────
        // Jamais utiliser ces couleurs directement en hex dans les composants.
        // Passer par intent.ts → getIntentColor() pour les styles inline.
        intent: {
          cta:     "#1DB954",
          success: "#1DB954",
          confirm: "#1DB954",
          error:   "#DC2626",
          neutral: "#0A0A0A",
          muted:   "#6B7280",
        },
        bg:      "var(--bg)",
        bg2:     "var(--bg2)",
        card:    "var(--card)",
        card2:   "var(--card2)",
        border:  "var(--border)",
        border2: "var(--border2)",
        text:    "var(--text)",
        text2:   "var(--text2)",
        text3:   "var(--text3)",
        g1:      "var(--g1)",
        g2:      "var(--g2)",
        g3:      "var(--g3)",
        amber:   "var(--amber)",
        red:     "var(--red)",
        purple:  "var(--purple)",
        blue:    "var(--blue)",
      },
      boxShadow: {
        soft:  "0 2px 16px rgba(0,0,0,.07)",
        card:  "0 4px 24px rgba(0,0,0,.10)",
        green: "0 4px 24px rgba(13,158,110,.22)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
