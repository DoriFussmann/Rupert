/** @type {import('tailwindcss').Config} */
/**
 * Design tokens from Design Guide.md — theme extensions only.
 * Consumed by Tailwind via @config in src/styles/global.css.
 */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
    },
    extend: {
      colors: {
        primary: "#2c4a6e",
        secondary: "rgba(26, 26, 26, 0.64)",
        accent: "#2f5eff",
        background: "#ffffff",
        surface: "#fafafa",
        soft: "#fafafa",
        line: "#e6e6e6",
        // Design Guide lists #8a8a8a; darkened to meet §11 WCAG AA at 13px body/chrome
        muted: "#6b6b6b",
        ink: "#1a1a1a",
        success: "#1e7f4f",
        warning: "#b45309",
        error: "#2f5eff",
        placeholder: "#b5b5b5",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Reconciled scale: extracted display/chrome + proposed content scale
        display: ["3rem", { lineHeight: "1.15" }], // 48px hero
        h1: ["2rem", { lineHeight: "1.25" }], // 32px
        h2: ["1.5rem", { lineHeight: "1.3" }], // 24px
        h3: ["1.25rem", { lineHeight: "1.35" }], // 20px
        h4: ["1.0625rem", { lineHeight: "1.4" }], // 17px
        body: ["0.9375rem", { lineHeight: "1.5" }], // 15px
        small: ["0.8125rem", { lineHeight: "1.5" }], // 13px chrome/cards
        "brand-mobile": ["1.5rem", { lineHeight: "1.2" }], // 24px
      },
      maxWidth: {
        shell: "1280px",
        prose: "48rem", // max-w-3xl article body
      },
      borderRadius: {
        lg: "0.5rem", // 8px
        xl: "0.5rem", // Design Guide: rounded-xl = 8px
      },
      spacing: {
        // Base unit 4px (Tailwind default); prefer 8/12/16/24/32
      },
      transitionDuration: {
        panel: "280ms",
        chevron: "200ms",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
