import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pits: {
          black: "#000000",
          secondary: "#A8C400",
          card: "#1A1A1C",
          grey: "#C9C9C9",
          panel: "#1A1A1A",
          darkGrey: "#151515",
          gunmetal: "#6E6E6E",
          primary: "#D7FF00",
          redDark: "#B00500",
          accent: "#9BA1A6",
          /* Dark content area — pairs with fluorescent primary */
          surface: "#0C0C0C",
          surfaceElevated: "#1A1A1A",
          surfaceMuted: "#262626",
          edge: "#505050",
          ink: "#FFFFFF",
          inkMuted: "#A8ACA4",
          primarySoft: "#2A3318",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        inter: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-jakarta)", "ui-sans-serif", "system-ui", "sans-serif"],
        jakarta: ["var(--font-jakarta)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
    },
  },
};
export default config;
