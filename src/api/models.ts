/**
 * Registre des modèles, servi par l'API métier.
 *
 * Le dashboard affiche déjà la version de modèle qui a produit une prévision
 * ou fondé une recommandation. Ces deux lectures répondent à la question
 * suivante : *quelle version est promue en ce moment, et qu'y avait-il avant ?*
 * — utile quand une dérive apparaît juste après une promotion.
 *
 * Le dashboard ne promeut rien et ne compare rien : le registre est MLflow, et
 * l'API en est la seule vue.
 */

import type { AxiosInstance } from "axios";
import type { components } from "../types/api";
import { API_SERVICE_LABEL } from "./sites";
import { toApiError } from "./http";

/** Modèle du registre, tel que le contrat le publie. */
export type Model = components["schemas"]["ModelOut"];

/** Chemin du registre complet. */
export const MODELS_PATH = "/api/v1/models";

/** Chemin du modèle actuellement promu. */
export const CURRENT_MODEL_PATH = `${MODELS_PATH}/current`;

/** Lit le registre des modèles. */
export async function fetchModels(
  client: AxiosInstance,
  signal?: AbortSignal,
): Promise<Model[]> {
  try {
    const response = await client.get<Model[]>(MODELS_PATH, { signal });
    return response.data;
  } catch (error) {
    throw toApiError(error, API_SERVICE_LABEL);
  }
}

/**
 * Lit le modèle actuellement promu.
 *
 * Le contrat prévoit un 404 quand aucun modèle n'est promu — c'est le cas
 * courant tant que rien n'a été publié au registre MLflow, et il ne doit pas
 * être présenté comme une panne.
 */
export async function fetchCurrentModel(
  client: AxiosInstance,
  signal?: AbortSignal,
): Promise<Model> {
  try {
    const response = await client.get<Model>(CURRENT_MODEL_PATH, { signal });
    return response.data;
  } catch (error) {
    throw toApiError(error, API_SERVICE_LABEL);
  }
}
