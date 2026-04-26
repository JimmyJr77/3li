import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        // Use IPv4 loopback so the proxy does not hit ::1 while the API listens on 127.0.0.1 (common 502 in dev).
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});
