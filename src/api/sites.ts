/**
 * Référentiel des sites, servi par l'API métier (EV-11).
 *
 * Les types viennent du contrat gelé : aucun DTO réseau n'est redéclaré ici.
 */

import type { AxiosInstance } from "axios";
import type { components } from "../types/api";
import { toApiError } from "./http";

/** Site supervisé tel que publié par le contrat. */
export type Site = components["schemas"]["SiteOut"];

/** Nom du service affiché dans les messages d'erreur. */
export const API_SERVICE_LABEL = "L'API métier";

/** Chemin du référentiel dans le contrat gelé. */
export const SITES_PATH = "/api/v1/sites";

/** Récupère la liste complète des sites. Le contrat ne pagine pas cette route. */
export async function fetchSites(
  client: AxiosInstance,
  signal?: AbortSignal,
): Promise<Site[]> {
  try {
    const response = await client.get<Site[]>(SITES_PATH, { signal });
    return response.data;
  } catch (error) {
    throw toApiError(error, API_SERVICE_LABEL);
  }
}

/**
 * Premier site à présélectionner.
 *
 * On privilégie un site en exploitation pour que l'écran s'ouvre sur des
 * données vivantes, sans jamais imposer ce choix ensuite : c'est une valeur
 * initiale, pas une contrainte.
 */
export function pickInitialSite(sites: readonly Site[]): Site | null {
  return sites.find((site) => site.status.toLowerCase() === "active") ?? sites[0] ?? null;
}
