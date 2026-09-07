/**
 * Alertes énergétiques d'un site, servies par l'API métier (EV-17).
 *
 * Cette route a longtemps répondu **501** : le ticket a été écrit à cette
 * époque, et il demande d'ailleurs de consommer « l'endpoint alerts de l'API
 * Mock ». Le dashboard ne parle pas à la source — il n'a jamais eu le droit de
 * le faire — et n'en a plus besoin : le contrat 1.5.0 publie
 * `GET /api/v1/alerts`, que l'API sert depuis la table `alerte`.
 *
 * Deux propriétés du contrat commandent tout ce qui suit :
 *
 *   - l'API sert un **journal**, trié du plus récent au plus ancien. Ce n'est
 *     pas l'ordre qu'un exploitant veut lire : le tri par gravité est fait
 *     côté écran, et c'est explicitement ce que demande le ticket ;
 *   - la source ne publie que les alertes **actives**, donc une alerte résolue
 *     disparaît de sa réponse — c'est-à-dire au moment précis où l'on cherche
 *     à l'expliquer. L'API conserve le journal, et la lecture se fait par
 *     fenêtre de temps.
 */

import type { AxiosInstance } from "axios";
import type { components } from "../types/api";
import { API_SERVICE_LABEL } from "./sites";
import { toApiError } from "./http";

/** Alerte telle que publiée par le contrat. */
export type Alert = components["schemas"]["AlertOut"];

/** Gravité, sur l'échelle commune aux alertes et aux recommandations. */
export type AlertSeverity = Alert["severity"];

/** Nature de l'anomalie détectée. */
export type AlertType = Alert["type"];

/** Chemin des alertes dans le contrat gelé. */
export const ALERTS_PATH = "/api/v1/alerts";

/** Taille de page demandée. C'est aussi le défaut du contrat. */
export const ALERTS_LIMIT = 100;

/**
 * Ordre de gravité, du plus grave au moins grave.
 *
 * Explicite plutôt qu'alphabétique : `critical` < `high` < `low` < `medium`
 * dans l'ordre des chaînes, ce qui n'a aucun sens pour un exploitant.
 */
const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

interface FetchAlertsOptions {
  client: AxiosInstance;
  /** Restreindre à un site. Sans lui, l'API rend le parc entier. */
  siteId?: string;
  /** Borne inférieure incluse du déclenchement, ISO 8601 UTC. */
  startTime?: string;
  /** Borne supérieure incluse du déclenchement, ISO 8601 UTC. */
  endTime?: string;
  signal?: AbortSignal;
}

/**
 * Trie les alertes par gravité, puis par horodatage décroissant.
 *
 * Le second critère n'est pas décoratif : à gravité égale, ce qui vient de se
 * produire compte plus que ce qui s'est produit hier. Le tri est stable et ne
 * modifie pas le tableau reçu.
 */
export function sortBySeverity(alerts: readonly Alert[]): Alert[] {
  return [...alerts].sort((left, right) => {
    const gravite = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
    return gravite !== 0 ? gravite : right.timestamp.localeCompare(left.timestamp);
  });
}

/** Lit les alertes d'une fenêtre, triées par gravité. */
export async function fetchAlerts({
  client,
  siteId,
  startTime,
  endTime,
  signal,
}: FetchAlertsOptions): Promise<Alert[]> {
  try {
    const response = await client.get<Alert[]>(ALERTS_PATH, {
      params: {
        site_id: siteId,
        start_time: startTime,
        end_time: endTime,
        limit: ALERTS_LIMIT,
      },
      signal,
    });
    return sortBySeverity(response.data);
  } catch (error) {
    throw toApiError(error, API_SERVICE_LABEL);
  }
}
