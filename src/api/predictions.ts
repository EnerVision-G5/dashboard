/**
 * Prédictions de consommation, lues sur l'API métier.
 *
 * Le dashboard ne déclenche jamais une prédiction et ne parle plus au service
 * d'inférence : un job planifié de l'API l'interroge périodiquement et archive
 * le résultat, que cette route relit. Le contrat de l'API en 1.1.0 publie
 * `GET /api/v1/sites/{site_id}/predictions`, symétrique de `/readings`.
 *
 * Conséquence de forme : la route sert des lignes plates, chacune portant sa
 * version de modèle et sa date de production, là où le service d'inférence
 * renvoyait un objet unique enveloppant ses points. La série est donc
 * recomposée ici, une fois, plutôt que dans chaque écran.
 */

import type { AxiosInstance } from "axios";
import type { components } from "../types/api";
import { toApiError } from "./http";

/** Point prédit, tel que l'API l'archive et le publie. */
export type PredictionPoint = components["schemas"]["PredictionPointOut"];

/** Page de prédictions renvoyée par le contrat. */
export type PredictionsPage = components["schemas"]["PredictionsPage"];

/**
 * Série prédite d'un site, recomposée depuis une page de l'API.
 *
 * `modelVersion` et `generatedAt` sont nuls quand la page est vide : aucune
 * prédiction n'a encore été archivée pour la fenêtre demandée, ce qui arrive
 * tant que le job planifié n'a pas tourné.
 */
export interface Prediction {
  siteId: string;
  modelVersion: string | null;
  generatedAt: string | null;
  points: PredictionPoint[];
}

/** Nom du service affiché dans les messages d'erreur. */
export const PREDICT_SERVICE_LABEL = "L'API EnerVision";

/** Chemin de la lecture des prédictions dans le contrat gelé. */
export function predictionsPath(siteId: string): string {
  return `/api/v1/sites/${encodeURIComponent(siteId)}/predictions`;
}

/** Profondeur de prévision affichée par l'écran EV-16. */
export const PREDICTION_HORIZON_HOURS = 24;

/** Taille de page demandée : un point par heure, la fenêtre tient largement. */
export const PREDICTIONS_PAGE_LIMIT = 1000;

interface FetchPredictionsOptions {
  client: AxiosInstance;
  siteId: string;
  startTime: string;
  endTime: string;
  signal?: AbortSignal;
}

/**
 * Recompose la série d'un site à partir d'une page de prédictions.
 *
 * La version retenue est celle du point le plus récemment produit : la fenêtre
 * peut mêler deux générations si le job a tourné entre-temps, et c'est la plus
 * fraîche qui décrit ce que le graphique montre.
 */
export function toPrediction(siteId: string, page: PredictionsPage): Prediction {
  const points = [...page.items];
  const latest = points.reduce<PredictionPoint | null>((current, point) => {
    if (current === null) {
      return point;
    }
    return point.generated_at > current.generated_at ? point : current;
  }, null);

  return {
    siteId,
    modelVersion: latest?.model_version ?? null,
    generatedAt: latest?.generated_at ?? null,
    points,
  };
}

/** Lit les prédictions archivées d'un site sur une fenêtre de temps. */
export async function fetchPredictions({
  client,
  siteId,
  startTime,
  endTime,
  signal,
}: FetchPredictionsOptions): Promise<Prediction> {
  try {
    const response = await client.get<PredictionsPage>(predictionsPath(siteId), {
      params: {
        start_time: startTime,
        end_time: endTime,
        limit: PREDICTIONS_PAGE_LIMIT,
      },
      signal,
    });
    return toPrediction(siteId, response.data);
  } catch (error) {
    throw toApiError(error, PREDICT_SERVICE_LABEL);
  }
}
