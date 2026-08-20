import type { Config } from "tailwindcss";

// Same palette as the original Claude Artifact prototype — do not restyle.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0F1C",
        bgPanel: "#0F1729",
        bgCard: "#131D33",
        bgCardHover: "#182241",
        line: "#22304F",
        lineBright: "#2E4066",
        gold: "#D4AF37",
        goldBright: "#F0C94A",
        orange: "#FF7A3D",
        ink: "#F5F7FA",
        muted: "#8B98B5",
        mutedDim: "#5C6989",
        green: "#3DDC97",
        red: "#FF5D6C",
        blue: "#4E9BFF",
        // ---- Light "premium sports event" theme, used only on public-facing
        // marketing pages (homepage, register, squads, standings, rules).
        // Purely additive — the dark tokens above are untouched, so Admin,
        // Team Owner, the Auction Control Room and the public Auction Display
        // (which is meant to stay dark/cinematic) keep working exactly as
        // they did before this palette existed.
        warmWhite: "#FFFDF8",
        cream: "#F7F3EA",
        navy: "#0B1F3A",
        navyText: "#152238",
        slateText: "#566274",
        adminBg: "#F5F7FA",
      },
      fontFamily: {
        display: ["Oswald", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
