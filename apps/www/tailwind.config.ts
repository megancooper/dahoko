import type { Config } from "tailwindcss";
import uiPreset from "@dahoko/ui/tailwind.preset";

const config: Config = {
  presets: [uiPreset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};

export default config;
