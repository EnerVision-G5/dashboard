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

/** Résultat d'une synchronisation du référentiel. */
export type SiteSync = components["schemas"]["SiteSyncOut"];

/** Chemin du référentiel dans le contrat gelé. */
export const SITES_PATH = "/api/v1/sites";

/** Chemin de la synchronisation du référentiel depuis la source. */
export const SITES_SYNC_PATH = `${SITES_PATH}/sync`;

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
 * Resynchronise le référentiel depuis la source.
 *
 * Exige le rôle `writer` : l'opération écrit en base, elle ne relit pas. Un
 * `reader` reçoit un 403, et l'écran doit le savoir avant de proposer le
 * bouton. Un 502 signale que la source n'a pas répondu — l'API a bien reçu la
 * demande, c'est la source qui manque.
 *
 * `received` et `synchronized` peuvent différer : la source annonce des sites
 * que l'API refuse s'il leur manque un champ obligatoire du contrat. L'écart
 * est affiché plutôt que masqué.
 */
export async function syncSites(
  client: AxiosInstance,
  signal?: AbortSignal,
): Promise<SiteSync> {
  try {
    const response = await client.post<SiteSync>(SITES_SYNC_PATH, undefined, { signal });
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
