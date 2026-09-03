/**
 * Prédiction de consommation, servie par le service d'inférence.
 *
 * Le contrat gelé 1.0.0 expose ce service séparément de l'API métier. Le
 * dashboard n'appelle jamais l'API Mock IoT directement.
 */

import type { AxiosInstance } from "axios";
import type { components } from "../types/predict";
import { toApiError } from "./http";

/** Prévision complète renvoyée pour un site. */
export type Prediction = components["schemas"]["PredictionOut"];

/** Point de la série prédite. */
export type PredictionPoint = components["schemas"]["PredictionPoint"];

/** Demande de prévision telle que définie par le contrat. */
export type PredictionRequest = components["schemas"]["PredictionRequest"];

/** Nom du service affiché dans les messages d'erreur. */
export const PREDICT_SERVICE_LABEL = "Le service d'inférence";

/** Chemin de la prédiction dans le contrat gelé. */
export const PREDICT_PATH = "/api/v1/predict";

/** Profondeur de prévision demandée par l'écran EV-16. */
export const PREDICTION_HORIZON_HOURS = 24;

interface FetchPredictionOptions {
  client: AxiosInstance;
  siteId: string;
  horizonHours?: number;
  signal?: AbortSignal;
}

/** Demande une prévision au service d'inférence. */
export async function fetchPrediction({
  client,
  siteId,
  horizonHours = PREDICTION_HORIZON_HOURS,
  signal,
}: FetchPredictionOptions): Promise<Prediction> {
  const payload: PredictionRequest = {
    site_id: siteId,
    horizon_hours: horizonHours,
  };
  try {
    const response = await client.post<Prediction>(PREDICT_PATH, payload, { signal });
    return response.data;
  } catch (error) {
    throw toApiError(error, PREDICT_SERVICE_LABEL);
  }
}
