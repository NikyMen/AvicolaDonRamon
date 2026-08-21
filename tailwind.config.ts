import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Paleta de la marca "Entre Ríos"
        brand: {
          // Acento configurable desde el panel (ver src/lib/theme.ts).
          // Se resuelve vía variables CSS con soporte de opacidad de Tailwind.
          red: "rgb(var(--brand-red) / <alpha-value>)",
          dark: "rgb(var(--brand-dark) / <alpha-value>)",
          gold: "#F6B40A",
          amber: "#F59E0B",
          cream: "#FFF8EE",
          ink: "#1F1A17",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 8px 24px -10px rgba(31, 26, 23, 0.18)",
        soft: "0 2px 12px -4px rgba(31, 26, 23, 0.12)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "toast-in": {
          from: { transform: "translateX(120%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "toast-out": {
          from: { transform: "translateX(0)", opacity: "1" },
          to: { transform: "translateX(120%)", opacity: "0" },
        },
      },
      animation: {
        "toast-in": "toast-in 0.3s ease-out",
        "toast-out": "toast-out 0.3s ease-in forwards",
      },
    },
  },
  plugins: [],
};

export default config;
