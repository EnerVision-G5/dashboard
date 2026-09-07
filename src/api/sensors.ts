/**
 * État des capteurs d'un site, servi par l'API métier (EV-18).
 *
 * Le ticket demandait un bandeau « basé sur data_quality et sensors/status ».
 * Cette dernière route n'existait pas au contrat 1.1.0 ; le contrat 1.5.0
 * publie `GET /sites/{site_id}/sensors`, qui la remplace et dit davantage :
 * l'état de chaque capteur, la synthèse du site, et la date de rétablissement
 * annoncée par la source.
 *
 * Il n'existe **pas** de route équivalente pour tout le parc. L'état des
 * capteurs est donc lu pour le site affiché seulement, là où la fraîcheur et
 * la qualité couvrent les sept sites en une requête. Sept requêtes en
 * parallèle à chaque rafraîchissement coûteraient plus que ce que le bandeau
 * en tirerait ; le besoin est remonté plutôt que contourné.
 */

import type { AxiosInstance } from "axios";
import type { components } from "../types/api";
import { toApiError } from "./http";

/** État d'un capteur d'un site, tel que la source le déclare. */
export type SensorHealth = components["schemas"]["SensorHealthOut"];

/** Épisode de panne d'un capteur, borné par son début et sa fin. */
export type SensorFailure = components["schemas"]["SensorFailureOut"];

/** Capteur nommé par le contrat. */
export type SensorName = SensorHealth["capteur"];

/** Nom du service affiché dans les messages d'erreur. */
export const API_SERVICE_LABEL = "L'API métier";

/** Chemin de l'état des capteurs d'un site dans le contrat gelé. */
export function sensorsPath(siteId: string): string {
  return `/api/v1/sites/${encodeURIComponent(siteId)}/sensors`;
}

/** Chemin de l'historique des pannes de capteur d'un site. */
export function sensorHistoryPath(siteId: string): string {
  return `${sensorsPath(siteId)}/history`;
}

/**
 * Nombre d'épisodes de panne demandés.
 *
 * L'écran montre un historique, pas un journal d'exploitation : au-delà d'une
 * dizaine d'épisodes, la liste cesse d'être lisible et le besoin devient celui
 * d'un export, hors périmètre du dashboard.
 */
export const SENSOR_HISTORY_LIMIT = 10;

/** Lit l'état des capteurs d'un site. */
export async function fetchSensors(
  client: AxiosInstance,
  siteId: string,
  signal?: AbortSignal,
): Promise<SensorHealth[]> {
  try {
    const response = await client.get<SensorHealth[]>(sensorsPath(siteId), { signal });
    return response.data;
  } catch (error) {
    throw toApiError(error, API_SERVICE_LABEL);
  }
}

/**
 * Lit les épisodes de panne de capteur d'un site, le plus récent d'abord.
 *
 * Les épisodes en cours ne sont pas demandés séparément : le contrat accepte
 * un filtre `ongoing`, mais séparer les deux listes obligerait à deux requêtes
 * pour reconstituer une chronologie que l'API sert déjà d'un bloc — `ongoing`
 * distingue les deux cas sur chaque ligne.
 */
export async function fetchSensorHistory(
  client: AxiosInstance,
  siteId: string,
  signal?: AbortSignal,
): Promise<SensorFailure[]> {
  try {
    const response = await client.get<SensorFailure[]>(sensorHistoryPath(siteId), {
      params: { limit: SENSOR_HISTORY_LIMIT },
      signal,
    });
    return response.data;
  } catch (error) {
    throw toApiError(error, API_SERVICE_LABEL);
  }
}
