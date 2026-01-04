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
          bg: '#F3F4F6',     // Light Gray Background (Main)
          card: '#FFFFFF',   // White Cards
          text: '#111827',   // Dark Text (Gray 900)
          dim: '#6B7280',    // Muted Text (Gray 500)
          red: '#FF2800',    // Ferrari Red (The Brand)
          
          // Semantic Helpers
          success: '#10B981', // Emerald 500
          error: '#EF4444',   // Red 500
        }
      },
    },
  },
  plugins: [],
};
export default config;