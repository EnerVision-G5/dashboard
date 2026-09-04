/**
 * Lecture centralisée de la configuration du dashboard.
 *
 * Deux sources, dans cet ordre :
 *
 *   1. `window.__ENERVISION_CONFIG__`, injectée au démarrage du conteneur par
 *      `/config.js` (voir `config.js.template`). C'est le chemin de
 *      production : l'image est construite une fois par commit et déployée
 *      telle quelle sur des environnements dont les domaines diffèrent, les
 *      adresses ne peuvent donc pas être figées au build ;
 *   2. `import.meta.env`, que Vite fige au build depuis le `.env`. C'est le
 *      chemin du développement, inchangé.
 *
 * L'ordre compte : en image, `/config.js` gagne. En développement, il n'existe
 * pas et le `.env` reprend la main sans qu'on ait à le dire.
 *
 * Les variables sont relues à chaque appel plutôt que figées au chargement du
 * module : les tests peuvent ainsi les redéfinir sans recharger le graphe
 * d'imports.
 *
 * Aucune valeur par défaut n'est inventée pour les URL de service. Une base
 * absente est une erreur de configuration explicite, pas un repli silencieux
 * vers un hôte qui n'existe peut-être pas : mieux vaut un message clair qu'une
 * requête qui échoue sans que l'on sache d'où vient l'adresse appelée.
 */

/** Origine de la série prédite, choisie explicitement à la configuration. */
export type PredictionSource = "api" | "fixture";

/** Configuration injectée au démarrage du conteneur. Absente en développement. */
export interface InjectedConfig {
  apiBaseUrl?: string;
  predictionSource?: string;
}

declare global {
  interface Window {
    __ENERVISION_CONFIG__?: InjectedConfig;
  }
}

/** Erreur de configuration du dashboard, distincte d'une erreur réseau. */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/** Rend la valeur si elle porte quelque chose, `undefined` sinon. */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

/**
 * Lit une valeur, en préférant la configuration injectée au `.env` du build.
 *
 * `injectedKey` est absente pour les réglages qui n'ont de sens qu'en
 * développement : ils ne sont alors lus que dans `import.meta.env`.
 */
function read(viteKey: string, injectedKey?: keyof InjectedConfig): string | undefined {
  if (injectedKey !== undefined) {
    // `globalThis.window` plutôt que `window` : le module est aussi importé
    // hors navigateur (génération de types, outils), où `window` n'existe pas.
    const injected = clean(globalThis.window?.__ENERVISION_CONFIG__?.[injectedKey]);
    if (injected !== undefined) {
      return injected;
    }
  }
  return clean(import.meta.env[viteKey] as string | undefined);
}

function readRequiredBaseUrl(
  viteKey: string,
  injectedKey: keyof InjectedConfig,
): string {
  const value = read(viteKey, injectedKey);
  if (value === undefined) {
    throw new ConfigurationError(
      `${viteKey} n'est pas configurée. En développement, copier .env.example en .env ; ` +
        `en image, renseigner la variable d'environnement du conteneur.`,
    );
  }
  // Une base terminée par « / » produirait des doubles slashs une fois
  // concaténée aux chemins du contrat, qui commencent tous par « / ».
  return value.replace(/\/+$/, "");
}

/** Base HTTP de l'API métier (sites et mesures). */
export function getApiBaseUrl(): string {
  return readRequiredBaseUrl("VITE_API_BASE_URL", "apiBaseUrl");
}

/** Valeur par défaut : le dashboard lit les prédictions archivées par l'API. */
export const DEFAULT_PREDICTION_SOURCE: PredictionSource = "api";

/**
 * Origine de la série prédite, choisie explicitement par configuration.
 *
 * Le mode `fixture` sert au développement, quand aucune prédiction n'a encore
 * été archivée en base. Il n'est jamais déclenché par un échec d'appel : en
 * mode `api`, une panne reste une panne affichée comme telle.
 *
 * Une valeur inconnue retombe sur `api` : mieux vaut une erreur réseau visible
 * qu'un basculement silencieux vers des données inventées à cause d'une faute
 * de frappe dans la configuration.
 */
export function getPredictionSource(): PredictionSource {
  return read("VITE_PREDICTION_SOURCE", "predictionSource") === "fixture"
    ? "fixture"
    : DEFAULT_PREDICTION_SOURCE;
}
