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
          black: '#121212',  // Matte Black
          dark: '#1E1E1E',   // Card Background
          red: '#FF2800',    // Ferrari Red
          gray: '#E0E0E0',   // Text
        }
      },
    },
  },
};
export default config;
