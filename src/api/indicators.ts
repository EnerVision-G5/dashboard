/**
 * Indicateurs de confiance des sites, servis par l'API métier (EV-18).
 *
 * L'API calcule elle-même la fraîcheur d'ingestion, la part de mesures
 * dégradées et l'écart prédiction/réel, et publie **avec chaque indicateur le
 * seuil qui le qualifie** : `stale_threshold_seconds` pour la fraîcheur,
 * `threshold` pour la qualité. Le dashboard n'a donc aucun seuil à choisir,
 * et un seuil révisé côté exploitation n'a pas à être suivi ici.
 *
 * Une seule requête couvre tout le parc : le bandeau parle de « sites en
 * degraded ou critical », il lui faut les sept sites, pas seulement celui qui
 * est affiché.
 */

import type { AxiosInstance } from "axios";
import type { components } from "../types/api";
import { toApiError } from "./http";

/** Les trois indicateurs d'un site, tels que le contrat les publie. */
export type SiteIndicators = components["schemas"]["SiteIndicatorsOut"];

/** Fraîcheur de la dernière ingestion d'un site. */
export type IngestionIndicator = components["schemas"]["IngestionIndicatorOut"];

/** Part de mesures dégradées d'un site sur la fenêtre. */
export type QualityIndicator = components["schemas"]["QualityIndicatorOut"];

/** Nom du service affiché dans les messages d'erreur. */
export const API_SERVICE_LABEL = "L'API métier";

/** Chemin des indicateurs de tout le parc dans le contrat gelé. */
export const INDICATORS_PATH = "/api/v1/indicators";

/**
 * Profondeur de fenêtre demandée aux indicateurs, en heures.
 *
 * Alignée sur la fenêtre du graphique : le bandeau doit qualifier les données
 * que l'écran montre, pas une autre période.
 */
export const INDICATORS_WINDOW_HOURS = 24;

interface FetchIndicatorsOptions {
  client: AxiosInstance;
  /** Fenêtre de calcul des parts, en heures. */
  windowHours?: number;
  signal?: AbortSignal;
}

/** Lit les indicateurs de confiance de tous les sites supervisés. */
export async function fetchIndicators({
  client,
  windowHours = INDICATORS_WINDOW_HOURS,
  signal,
}: FetchIndicatorsOptions): Promise<SiteIndicators[]> {
  try {
    const response = await client.get<SiteIndicators[]>(INDICATORS_PATH, {
      params: { window_hours: windowHours },
      signal,
    });
    return response.data;
  } catch (error) {
    throw toApiError(error, API_SERVICE_LABEL);
  }
}
