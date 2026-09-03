/**
 * Mesures énergétiques d'un site, servies par l'API métier (EV-11).
 *
 * Les valeurs traversent telles quelles : `consumption_kw` peut être `null`,
 * `consumption_kw_imputed` reste une donnée distincte et n'est jamais promue
 * en mesure réelle.
 */

import type { AxiosInstance } from "axios";
import type { components } from "../types/api";
import { API_SERVICE_LABEL } from "./sites";
import { toApiError } from "./http";

/** Mesure horodatée telle que publiée par le contrat. */
export type EnergyReading = components["schemas"]["EnergyReadingOut"];

/** Page de mesures et ses métadonnées de pagination. */
export type ReadingsPage = components["schemas"]["ReadingsPage"];

/** Taille de page maximale autorisée par le contrat. */
export const READINGS_PAGE_LIMIT = 1000;

/**
 * Garde-fou contre une boucle de pagination infinie.
 *
 * Une fenêtre de 24 h à la minute produit 1 440 mesures, soit deux pages. Une
 * vingtaine de pages laisse une marge confortable tout en bornant la boucle si
 * le serveur renvoyait un `meta.total` incohérent.
 */
export const MAX_READING_PAGES = 20;

/** Chemin des mesures d'un site dans le contrat gelé. */
export function readingsPath(siteId: string): string {
  return `/api/v1/sites/${encodeURIComponent(siteId)}/readings`;
}

/** Chemin de la dernière mesure connue d'un site. */
export function latestReadingPath(siteId: string): string {
  return `${readingsPath(siteId)}/latest`;
}

/**
 * Âge au-delà duquel la dernière mesure est tenue pour en retard.
 *
 * La collecte interroge l'API Mock toutes les minutes. Deux minutes laissent
 * donc passer un cycle manqué sans crier au loup, et signalent le suivant :
 * c'est le seuil retenu par le guide d'intégration front.
 */
export const STALE_READING_MS = 120_000;

/**
 * Récupère la dernière mesure connue d'un site.
 *
 * Sert le panneau temps réel. Le 404 du contrat — site inconnu, ou site sans
 * aucune mesure — remonte comme les autres erreurs : c'est au panneau de
 * décider quoi en dire, pas à ce client d'inventer une mesure vide.
 */
export async function fetchLatestReading(
  client: AxiosInstance,
  siteId: string,
  signal?: AbortSignal,
): Promise<EnergyReading> {
  try {
    const response = await client.get<EnergyReading>(latestReadingPath(siteId), { signal });
    return response.data;
  } catch (error) {
    throw toApiError(error, API_SERVICE_LABEL);
  }
}

/**
 * Vrai si la mesure date de plus de `STALE_READING_MS`.
 *
 * Un horodatage illisible est tenu pour en retard : mieux vaut afficher un
 * doute que présenter une valeur d'âge inconnu comme fraîche.
 */
export function isStale(reading: EnergyReading, now: Date = new Date()): boolean {
  const measuredAt = Date.parse(reading.timestamp);
  return Number.isNaN(measuredAt) || now.getTime() - measuredAt > STALE_READING_MS;
}

interface FetchReadingsOptions {
  client: AxiosInstance;
  siteId: string;
  /** Borne inférieure incluse, ISO 8601 UTC. */
  startTime: string;
  /** Borne supérieure incluse, ISO 8601 UTC. */
  endTime: string;
  signal?: AbortSignal;
}

/**
 * Récupère toutes les mesures d'une fenêtre en suivant la pagination.
 *
 * L'API plafonne une page à 1 000 éléments : la fenêtre est parcourue jusqu'à
 * atteindre `meta.total`, sans quoi le graphique n'afficherait qu'un début de
 * journée.
 */
export async function fetchReadings({
  client,
  siteId,
  startTime,
  endTime,
  signal,
}: FetchReadingsOptions): Promise<EnergyReading[]> {
  const path = readingsPath(siteId);
  const items: EnergyReading[] = [];

  try {
    for (let page = 0; page < MAX_READING_PAGES; page += 1) {
      const response = await client.get<ReadingsPage>(path, {
        signal,
        params: {
          start_time: startTime,
          end_time: endTime,
          limit: READINGS_PAGE_LIMIT,
          offset: items.length,
        },
      });
      const { items: pageItems, meta } = response.data;
      items.push(...pageItems);
      // Une page vide arrête la boucle même si meta.total annonce davantage :
      // sans cette garde, un total surévalué la ferait tourner à vide.
      if (pageItems.length === 0 || items.length >= meta.total) {
        break;
      }
    }
  } catch (error) {
    throw toApiError(error, API_SERVICE_LABEL);
  }

  return items;
}
