import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
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
  test: {
    // Les composants sont testés via Testing Library : il leur faut un DOM.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Pas de globals : les API de test sont importées explicitement, ce qui
    // garde le lint et TypeScript utiles dans les fichiers de test.
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
