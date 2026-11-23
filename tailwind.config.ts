import type { Config } from "tailwindcss";

// Same colours as the Flutter app's AppColors, so both apps look like one product.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0A",
        surface: "#1A1A1A",
        surfaceElevated: "#242424",
        border: "#2E2E2E",
        textPrimary: "#FFFFFF",
        textSecondary: "#A0A0A0",
        accentPurple: "#9B5DE5",
        accentBlue: "#3A86FF",
        accentOrange: "#FB8500",
        accentGreen: "#06D6A0",
        accentPink: "#EF476F",
      },
    },
  },
  plugins: [],
};

export default config;
