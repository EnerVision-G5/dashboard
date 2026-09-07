import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin, type ProxyOptions } from 'vite'
import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'

/**
 * Proxy de développement.
 *
 * L'API métier ne publie ses en-têtes `Access-Control-*` que pour les origines
 * listées dans sa variable CORS_ALLOWED_ORIGINS. Tant qu'elle n'y connaît pas
 * http://localhost:5173, sa réponse est bloquée par le navigateur. Servir l'API
 * derrière l'origine de Vite évite le cross-origin sur le poste de
 * développement, sans rien changer au code applicatif : il suffit de pointer
 * VITE_API_BASE_URL sur le préfixe ci-dessous.
 *
 * Ce proxy ne concerne que `npm run dev`. En production, l'API autorise
 * l'origine du dashboard par CORS_ALLOWED_ORIGINS.
 */
function devProxy(env: Record<string, string>): Record<string, ProxyOptions> {
  const routes: Record<string, ProxyOptions> = {}
  const targets = [
    { prefix: '/proxy/api', target: env.VITE_DEV_PROXY_API_TARGET },
  ]
  for (const { prefix, target } of targets) {
    if (target !== undefined && target !== '') {
      routes[prefix] = {
        target,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(prefix, ''),
      }
    }
  }
  return routes
}

/**
 * Sert /config.js en développement.
 *
 * En image, ce fichier est produit au démarrage du conteneur par envsubst et
 * servi par Nginx. Le serveur de développement, lui, ne le connaît pas : sans
 * ce greffon, index.html déclencherait un 404 à chaque chargement de page.
 *
 * Il rend une configuration vide, jamais des adresses : en développement la
 * source de vérité reste le .env, lu par import.meta.env. Y injecter des
 * valeurs ici créerait une seconde vérité, et un écart possible entre ce qu'on
 * teste et ce qu'on déploie.
 */
function devConfigJs(): Plugin {
  return {
    name: 'enervision-dev-config-js',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/config.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript')
        res.end('window.__ENERVISION_CONFIG__ = {}\n')
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), devConfigJs()],
    server: {
      // Écoute sur toutes les interfaces : joignable depuis l'hôte quand on
      // tourne dans un container Docker.
      host: true,
      port: 5173,
      strictPort: true,
      watch: {
        // Le polling permet au HMR de détecter les changements de fichiers à
        // travers un bind mount Docker (Windows / macOS / WSL2).
        usePolling: true,
      },
      proxy: devProxy(env),
    },
    test: {
      // Les composants sont testés via Testing Library : il leur faut un DOM.
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // Pas de globals : les API de test sont importées explicitement, ce qui
      // garde le lint et TypeScript utiles dans les fichiers de test.
      globals: false,
      include: ['src/**/*.test.{ts,tsx}'],
      // Valeurs figées : sans elles, le `.env` du poste (par exemple un
      // VITE_PREDICTION_SOURCE=fixture laissé après une recette) fuiterait
      // dans les tests et les ferait échouer selon la machine. Chaque test
      // redéfinit ce dont il a besoin avec `vi.stubEnv`.
      env: {
        VITE_API_BASE_URL: 'http://api.test',
        VITE_PREDICTION_SOURCE: 'api',
      },
    },
  }
})
