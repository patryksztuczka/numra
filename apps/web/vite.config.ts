import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Client-side routes: /connections, /accounts, /transactions
    // Vite already falls back to index.html for unknown paths in dev.
  },
  preview: {
    port: 5173,
  },
  appType: "spa",
});
