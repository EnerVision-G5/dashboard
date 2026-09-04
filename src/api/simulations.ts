/**
 * Simulations de pic de consommation, servies par l'API métier.
 *
 * Deux opérations de nature très différente, et c'est ce qui compte ici :
 *
 *   - la **lecture** de l'historique n'exige que d'être authentifié ;
 *   - le **déclenchement** exige le rôle `writer`, parce qu'il ne simule rien
 *     dans le dashboard : l'API relaie l'ordre à la source, qui produit un pic
 *     bien réel dans les mesures suivantes. Un `reader` reçoit un 403, et
 *     l'écran doit le savoir avant de proposer le bouton.
 *
 * Le déclenchement peut aussi échouer en **502** : l'API a bien reçu l'ordre
 * mais la source ne l'a pas honoré. Ce cas est distinct d'un refus de rôle et
 * mérite son propre message.
 */

import type { AxiosInstance } from "axios";
import type { components } from "../types/api";
import { API_SERVICE_LABEL } from "./sites";
import { toApiError } from "./http";

/** Pic simulé, tel que l'API l'archive et le publie. */
export type SpikeSimulation = components["schemas"]["SpikeSimulationOut"];

/** Chemin de l'historique des pics simulés. */
export const SPIKES_PATH = "/api/v1/simulations/spike";

/** Chemin du déclenchement d'un pic sur un site. */
export function triggerSpikePath(siteId: string): string {
  return `${SPIKES_PATH}/${encodeURIComponent(siteId)}`;
}

/**
 * Durée par défaut du pic déclenché, en minutes.
 *
 * C'est le défaut du contrat, repris explicitement pour que la valeur envoyée
 * soit lisible ici plutôt que devinée. Trente minutes suffisent à voir la
 * pointe apparaître sur un graphique à la minute, sans laisser le site en
 * surconsommation pendant toute la démonstration.
 */
export const SPIKE_DURATION_MINUTES = 30;

/** Nombre d'épisodes lus dans l'historique. */
export const SPIKES_LIMIT = 10;

interface FetchSpikesOptions {
  client: AxiosInstance;
  /** Restreindre à un site. Sans lui, l'API rend le parc entier. */
  siteId?: string;
  signal?: AbortSignal;
}

/** Lit l'historique des pics simulés, le plus récent d'abord. */
export async function fetchSpikes({
  client,
  siteId,
  signal,
}: FetchSpikesOptions): Promise<SpikeSimulation[]> {
  try {
    const response = await client.get<SpikeSimulation[]>(SPIKES_PATH, {
      params: { site_id: siteId, limit: SPIKES_LIMIT },
      signal,
    });
    return response.data;
  } catch (error) {
    throw toApiError(error, API_SERVICE_LABEL);
  }
}

interface TriggerSpikeOptions {
  client: AxiosInstance;
  siteId: string;
  /** Durée du pic, en minutes. Bornée par le contrat. */
  durationMinutes?: number;
  signal?: AbortSignal;
}

/**
 * Déclenche un pic de consommation sur un site.
 *
 * L'API répond 201 avec l'épisode archivé. Le pic n'apparaîtra dans les
 * mesures qu'au relevé suivant : la source le produit, la collecte l'ingère,
 * et c'est seulement alors que le graphique le montre.
 */
export async function triggerSpike({
  client,
  siteId,
  durationMinutes = SPIKE_DURATION_MINUTES,
  signal,
}: TriggerSpikeOptions): Promise<SpikeSimulation> {
  try {
    const response = await client.post<SpikeSimulation>(
      triggerSpikePath(siteId),
      undefined,
      { params: { duration_minutes: durationMinutes }, signal },
    );
    return response.data;
  } catch (error) {
    throw toApiError(error, API_SERVICE_LABEL);
  }
}
