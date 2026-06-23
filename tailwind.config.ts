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
        brand: {
          50:  "#f0f4ff",
          100: "#e0e9ff",
          200: "#c2d3ff",
          300: "#94b2ff",
          400: "#6088ff",
          500: "#3a5ff8",
          600: "#2840e8",
          700: "#1f2fd4",
          800: "#1e27ab",
          900: "#1e2687",
        },
        sage: {
          50:  "#f4f8f4",
          100: "#e5f0e5",
          200: "#cce1cc",
          300: "#a3c9a3",
          400: "#72aa72",
          500: "#4f8e4f",
          600: "#3c7240",
          700: "#315834",
          800: "#29472c",
          900: "#223b26",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
