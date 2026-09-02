/**
 * Lecture centralisée de la configuration Vite.
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

/** Erreur de configuration du dashboard, distincte d'une erreur réseau. */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function readVariable(name: string): string | undefined {
  const value = import.meta.env[name] as string | undefined;
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

function readRequiredBaseUrl(name: string): string {
  const value = readVariable(name);
  if (value === undefined) {
    throw new ConfigurationError(
      `${name} n'est pas configurée. Copier .env.example en .env et renseigner l'adresse du service.`,
    );
  }
  // Une base terminée par « / » produirait des doubles slashs une fois
  // concaténée aux chemins du contrat, qui commencent tous par « / ».
  return value.replace(/\/+$/, "");
}

/** Base HTTP de l'API métier (sites et mesures). */
export function getApiBaseUrl(): string {
  return readRequiredBaseUrl("VITE_API_BASE_URL");
}

/**
 * Base HTTP du service d'inférence.
 *
 * Le contrat gelé 1.0.0 publie encore deux spécifications distinctes
 * (`openapi-api.json` et `openapi-predict.json`), donc deux services. Le jour
 * où l'API métier fera proxy vers Predict, seule cette fonction changera : les
 * composants ne connaissent que `fetchPrediction`.
 */
export function getPredictBaseUrl(): string {
  return readRequiredBaseUrl("VITE_PREDICT_BASE_URL");
}
