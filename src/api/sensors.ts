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

/** Capteur nommé par le contrat. */
export type SensorName = SensorHealth["capteur"];

/** Nom du service affiché dans les messages d'erreur. */
export const API_SERVICE_LABEL = "L'API métier";

/** Chemin de l'état des capteurs d'un site dans le contrat gelé. */
export function sensorsPath(siteId: string): string {
  return `/api/v1/sites/${encodeURIComponent(siteId)}/sensors`;
}

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
