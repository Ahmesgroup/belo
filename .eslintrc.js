/** @type {import("eslint").Linter.Config} */

const HEX_COLOR_REGEX = "/#([0-9a-fA-F]{3,8})\\b/";

module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint"],
  // NOTE: 'next/core-web-vitals' removed — eslint-config-next has a circular
  // structure incompatible with current @eslint/eslintrc validator (Next 16
  // also deprecated `next lint`). Type checking is enforced by `next build`
  // (TypeScript strict). The rules below are the BELO design-system guards.
  extends: [
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    // ── INTENT SYSTEM GUARD ──────────────────────────────────────
    // Interdit les couleurs hex directes dans les fichiers source.
    // Toute couleur DOIT passer par intent.ts → getIntentColor()
    // ou utiliser les tokens Tailwind (bg-intent-cta, etc.)
    "no-restricted-syntax": [
      "warn",
      {
        // Catch raw hex literals inside style={{ color: "#..." }} or similar
        selector: `Property[key.name=/^(color|background|backgroundColor|borderColor|fill|stroke)$/] > Literal[value=${HEX_COLOR_REGEX}]`,
        message:
          "[BELO DESIGN] Hex color direct. Use getIntentColor(intent) or Tailwind intent-* token.",
      },
      {
        // Catch hardcoded animation duration numbers in motion props
        selector:
          "Property[key.name='duration'] > Literal[value>0][value<1] ~ Property[key.name='ease']",
        message:
          "[BELO MOTION] Hardcoded duration. Use MOTION.duration.* from @/lib/motion/motion.",
      },
      {
        // Catch cubic-bezier arrays that aren't the MOTION.easing constant
        selector:
          "Property[key.name='ease'] > ArrayExpression[elements.length=4]",
        message:
          "[BELO MOTION] Inline easing array. Use MOTION.easing from @/lib/motion/motion.",
      },
    ],

    // ── ANIMATION DURATION GUARD ─────────────────────────────────
    // Interdit de passer un nombre literal à 'duration' dans les
    // objets Framer Motion, sauf dans les fichiers motion/*.ts
    "no-restricted-properties": [
      "warn",
      {
        // Soft guard — too broad to be exact, documents intent
        object: "transition",
        property: "duration",
        message:
          "[BELO MOTION] Use MOTION.duration.* constants instead of literals.",
      },
    ],

    // ── TYPESCRIPT ───────────────────────────────────────────────
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-non-null-assertion": "warn",

    // ── REACT / NEXT ─────────────────────────────────────────────
    "react/no-unescaped-entities": "off",
    // "@next/next/no-img-element" removed — Next plugin no longer loaded
  },

  overrides: [
    {
      // The motion system files are EXEMPT from their own rules
      files: ["src/lib/motion/*.ts", "src/lib/design/*.ts"],
      rules: {
        "no-restricted-syntax": "off",
        "no-restricted-properties": "off",
      },
    },
    {
      // Test files
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],

  ignorePatterns: [
    ".next/",
    "node_modules/",
    "*.config.js",
    "*.config.ts",
  ],
};
