import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // SPA fallback covers client routes: /, /accounts, /transactions,
    // /connections, /privacy, /terms
  },
  preview: {
    port: 5173,
  },
  appType: "spa",
});
