import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Écoute sur toutes les interfaces : joignable depuis l'hôte quand on tourne
    // dans un container Docker.
    host: true,
    port: 5173,
    strictPort: true,
    watch: {
      // Le polling permet au HMR de détecter les changements de fichiers à
      // travers un bind mount Docker (Windows / macOS / WSL2).
      usePolling: true,
    },
  },
})
