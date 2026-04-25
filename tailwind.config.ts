import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#5b8def",
          dark: "#3a6fd6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
