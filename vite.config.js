import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Exposes the dev server on your LAN (not just localhost) so you can open
    // it from your phone's browser while it's on the same Wi-Fi network.
    // `npm run dev` will print both a localhost and a network URL — use the
    // network one on your phone.
    host: true,
  },
});
