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

/**
 * Page de configuration, atteignable depuis la navigation principale (EV-50).
 *
 * La route est déclarée ici et servie dès maintenant : un lien de navigation
 * qui retomberait sur la règle « * » ramènerait silencieusement au dashboard,
 * ce qui se lit comme une panne. Son contenu fonctionnel est le périmètre
 * d'EV-55.
 */
export const CONFIG_PATH = "/config";

/**
 * Écran de diagnostic d'un site (ingestion, écart, capteurs, modèles).
 *
 * Séparé du dashboard parce qu'onze cartes sur une page ne se lisent pas : la
 * supervision garde ce qu'on surveille, le diagnostic reçoit ce qui explique la
 * donnée et ce qui agit sur la source.
 */
export const DIAGNOSTIC_PATH = "/diagnostic";
