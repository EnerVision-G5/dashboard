/**
 * Chargement des mesures et de la prévision d'un site, fusionnées en une série
 * unique prête pour le graphique.
 *
 * Trois points de vigilance :
 *   - l'état retenu porte l'identifiant du site auquel il appartient, et n'est
 *     exposé que si cet identifiant est encore celui demandé. Les données d'un
 *     site ne peuvent donc jamais s'afficher sous le nom d'un autre, ni pendant
 *     le rechargement, ni si une réponse lente arrive après coup ;
 *   - la requête précédente est annulée à chaque changement de site ;
 *   - les deux flux échouent indépendamment. Une prévision indisponible n'efface
 *     pas des mesures correctement reçues, et réciproquement.
 */

import { useEffect, useState } from "react";
import type { Prediction } from "../api/predictions";
import type { ChartPoint } from "../lib/series";
import { fetchPrediction } from "../api/predictions";
import { fetchReadings } from "../api/readings";
import { getApiClient, getPredictClient } from "../api/clients";
import { isCancellation } from "../api/http";
import { buildChartSeries } from "../lib/series";
import { DEFAULT_WINDOW_HOURS, recentWindow } from "../lib/timeWindow";

/** État exposé par `useSiteSeries`. */
export interface SiteSeriesState {
  /** Série fusionnée, triée par horodatage croissant. */
  points: ChartPoint[];
  /** Prévision brute, notamment pour afficher la version du modèle. */
  prediction: Prediction | null;
  /** Vrai tant que les données du site demandé ne sont pas arrivées. */
  isLoading: boolean;
  /** Erreur du flux des mesures, `null` si le flux a abouti. */
  readingsError: string | null;
  /** Erreur du flux de prévision, `null` si le flux a abouti. */
  predictionError: string | null;
  /** Profondeur de la fenêtre interrogée, en heures. */
  windowHours: number;
}

interface LoadedState {
  /** Site auquel appartiennent les données ci-dessous. */
  siteId: string | null;
  points: ChartPoint[];
  prediction: Prediction | null;
  readingsError: string | null;
  predictionError: string | null;
}

const EMPTY: LoadedState = {
  siteId: null,
  points: [],
  prediction: null,
  readingsError: null,
  predictionError: null,
};

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function useSiteSeries(siteId: string | null): SiteSeriesState {
  const [loaded, setLoaded] = useState<LoadedState>(EMPTY);

  useEffect(() => {
    if (siteId === null) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function load(currentSiteId: string): Promise<void> {
      const { startTime, endTime } = recentWindow(new Date(), DEFAULT_WINDOW_HOURS);
      const [readings, prediction] = await Promise.allSettled([
        fetchReadings({
          client: getApiClient(),
          siteId: currentSiteId,
          startTime,
          endTime,
          signal: controller.signal,
        }),
        fetchPrediction({
          client: getPredictClient(),
          siteId: currentSiteId,
          signal: controller.signal,
        }),
      ]);

      if (!active) {
        return;
      }
      if (
        (readings.status === "rejected" && isCancellation(readings.reason)) ||
        (prediction.status === "rejected" && isCancellation(prediction.reason))
      ) {
        return;
      }

      const predicted = prediction.status === "fulfilled" ? prediction.value : null;
      setLoaded({
        siteId: currentSiteId,
        points: buildChartSeries(
          readings.status === "fulfilled" ? readings.value : [],
          predicted?.points ?? [],
        ),
        prediction: predicted,
        readingsError: readings.status === "rejected" ? messageOf(readings.reason) : null,
        predictionError:
          prediction.status === "rejected" ? messageOf(prediction.reason) : null,
      });
    }

    void load(siteId);

    return () => {
      active = false;
      controller.abort();
    };
  }, [siteId]);

  // Les données ne sont exposées que si elles proviennent bien du site demandé.
  const isCurrent = siteId !== null && loaded.siteId === siteId;

  return {
    points: isCurrent ? loaded.points : [],
    prediction: isCurrent ? loaded.prediction : null,
    readingsError: isCurrent ? loaded.readingsError : null,
    predictionError: isCurrent ? loaded.predictionError : null,
    isLoading: siteId !== null && !isCurrent,
    windowHours: DEFAULT_WINDOW_HOURS,
  };
}
