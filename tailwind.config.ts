import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans:  ["DM Sans", "sans-serif"],
        serif: ["Sora", "sans-serif"],
        mono:  ["JetBrains Mono", "monospace"],
      },
      colors: {
        bg:      "#06090d",
        bg2:     "#0b0f16",
        card:    "#0f1520",
        card2:   "#131d2a",
        border:  "#1a2332",
        border2: "#243040",
        g:       "#0d9e6e",
        g2:      "#22d38a",
        g3:      "#16a374",
      },
    },
  },
  plugins: [],
};

export default config;
