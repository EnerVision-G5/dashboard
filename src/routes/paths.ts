/** Adresses des écrans du dashboard, en un seul endroit (EV-48). */

/** Écran de connexion. */
export const LOGIN_PATH = "/login";

/** Écran de supervision, destination après une authentification réussie. */
export const DASHBOARD_PATH = "/";

/**
 * Page de démonstration du design system.
 *
 * Servie uniquement en développement : `AppRoutes` ne déclare cette route que
 * sous `import.meta.env.DEV`, que Vite remplace par `false` au build. Le
 * composant n'est alors référencé nulle part et disparaît du bundle de
 * production — vérifié par un test, la promesse ne valant rien sans preuve.
 */
export const DESIGN_SYSTEM_PATH = "/design-system";
