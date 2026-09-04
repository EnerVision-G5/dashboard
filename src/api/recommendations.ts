/**
 * Recommandations d'actions d'un site, servies par l'API métier (EV-54).
 *
 * L'API les **calcule à la demande** depuis les prévisions archivées du site :
 * le contrat le dit — « rien n'est archivé » — et c'est ce qui distingue cette
 * route des mesures. Deux appels successifs peuvent donc rendre des listes
 * différentes si le job de prédiction a tourné entre-temps, et chaque réponse
 * porte pour cette raison sa version de modèle et son heure de calcul.
 *
 * Le dashboard ne décide d'aucune action, n'en formule aucune, et n'en
 * reclasse aucune : `message` est décrit au contrat comme une « formulation
 * prête à afficher », et `items` arrive « de la plus urgente à la moins
 * urgente ». Réordonner cette liste côté navigateur reviendrait à substituer
 * notre jugement à celui du service qui a vu les chiffres.
 */

import type { AxiosInstance } from "axios";
import type { components } from "../types/api";
import { API_SERVICE_LABEL } from "./sites";
import { toApiError } from "./http";

/** Jeu de recommandations d'un site, tel que le contrat le publie. */
export type Recommendations = components["schemas"]["RecommendationsOut"];

/** Action proposée par l'API. */
export type Recommendation = components["schemas"]["RecommendationOut"];

/** Nature de l'action, telle que le contrat l'énumère. */
export type RecommendationType = Recommendation["type"];

/** Urgence de l'action, sur l'échelle des alertes. */
export type RecommendationSeverity = Recommendation["severity"];

/**
 * Profondeur de prévision examinée, en heures.
 *
 * Alignée sur la fenêtre de prédiction affichée par le graphique : conseiller
 * sur 24 heures pendant que l'écran en montre 24 est la moindre des
 * cohérences. C'est aussi le défaut du contrat, passé explicitement pour que
 * la valeur soit lisible ici plutôt que devinée.
 */
export const RECOMMENDATIONS_HORIZON_HOURS = 24;

/** Chemin des recommandations d'un site dans le contrat gelé. */
export function recommendationsPath(siteId: string): string {
  return `/api/v1/sites/${encodeURIComponent(siteId)}/recommendations`;
}

/**
 * Vrai quand des actions sont proposées **sans aucune prévision** derrière.
 *
 * C'est le mode dégradé de l'API : lorsque le service d'inférence est
 * indisponible — 503 tant qu'aucun modèle n'est publié au registre MLflow,
 * cas courant aujourd'hui — la route ne propage pas l'erreur. Elle répond 200
 * et sert la seule règle qui ne dépend pas de la prévision, la panne de
 * capteur, avec `model_version` à `null`.
 *
 * **Le contrat 1.5.0 ne publie aucun champ `degraded`.** L'état est donc
 * déduit, et il l'est du seul signal structurel disponible : des actions
 * servies alors qu'aucune version de modèle ne les fonde. Le champ `detail`
 * dit la même chose en français, mais s'appuyer sur son texte casserait à la
 * première reformulation côté API. Si ce mode doit devenir explicite, c'est
 * une PR de contrat — pas un champ inventé ici.
 */
export function isDegraded(recommendations: Recommendations): boolean {
  return (
    recommendations.items.length > 0 &&
    (recommendations.model_version === null || recommendations.model_version === undefined)
  );
}

interface FetchRecommendationsOptions {
  client: AxiosInstance;
  siteId: string;
  /** Profondeur de prévision examinée, en heures. */
  horizonHours?: number;
  signal?: AbortSignal;
}

/** Lit les recommandations d'un site sur l'horizon demandé. */
export async function fetchRecommendations({
  client,
  siteId,
  horizonHours = RECOMMENDATIONS_HORIZON_HOURS,
  signal,
}: FetchRecommendationsOptions): Promise<Recommendations> {
  try {
    const response = await client.get<Recommendations>(recommendationsPath(siteId), {
      params: { horizon_hours: horizonHours },
      signal,
    });
    return response.data;
  } catch (error) {
    throw toApiError(error, API_SERVICE_LABEL);
  }
}
