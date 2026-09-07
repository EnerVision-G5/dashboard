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
 *
 * Les deux flux interrogent la même API : les mesures sur la fenêtre écoulée,
 * les prédictions sur la fenêtre à venir. Le dashboard ne parle plus au
 * service d'inférence, un job planifié de l'API s'en charge.
 */

import { useEffect, useState } from "react";
import type { Prediction } from "../api/predictions";
import type { ChartPoint } from "../lib/series";
import { fetchPredictions } from "../api/predictions";
import { buildDemoPrediction } from "../fixtures/predictionDemo";
import { getPredictionSource, type PredictionSource } from "../config/env";
import { fetchReadings } from "../api/readings";
import { getApiClient } from "../api/clients";
import { isCancellation } from "../api/http";
import { buildChartSeries } from "../lib/series";
import type { TimeWindow } from "../lib/timeWindow";
import {
  DEFAULT_WINDOW_HOURS,
  predictionWindowFor,
  recentWindow,
  windowHours,
} from "../lib/timeWindow";

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
  /** Fenêtre réellement interrogée, telle qu'elle a été appliquée. */
  window: TimeWindow;
  /** Origine effective de la série prédite, telle que configurée. */
  predictionSource: PredictionSource;
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

/**
 * Charge les séries d'un site sur une fenêtre.
 *
 * `window` est optionnelle : sans elle, les 24 dernières heures sont lues,
 * comportement de l'écran avant EV-53. Avec elle, l'appelant choisit la
 * période — et c'est lui qui la fixe, une fois, plutôt que ce hook qui la
 * recalculerait à chaque rendu et relancerait les appels sans fin.
 */
export function useSiteSeries(
  siteId: string | null,
  window?: TimeWindow,
): SiteSeriesState {
  const [loaded, setLoaded] = useState<LoadedState>(EMPTY);
  const predictionSource = getPredictionSource();
  // Les bornes servent de dépendances à l'effet : deux objets de même contenu
  // ne doivent pas déclencher deux chargements.
  const startTimeRequested = window?.startTime ?? null;
  const endTimeRequested = window?.endTime ?? null;

  useEffect(() => {
    if (siteId === null) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function load(currentSiteId: string, source: PredictionSource): Promise<void> {
      const now = new Date();
      const readingsWindow =
        startTimeRequested !== null && endTimeRequested !== null
          ? { startTime: startTimeRequested, endTime: endTimeRequested }
          : recentWindow(now, DEFAULT_WINDOW_HOURS);
      const { startTime, endTime } = readingsWindow;
      // Les prédictions ne portent pas sur la même fenêtre que les mesures :
      // prolongée vers l'avenir quand l'écran touche le présent, identique
      // quand on examine une période passée.
      const forecast = predictionWindowFor(readingsWindow, now, DEFAULT_WINDOW_HOURS);
      const [readings, prediction] = await Promise.allSettled([
        fetchReadings({
          client: getApiClient(),
          siteId: currentSiteId,
          startTime,
          endTime,
          signal: controller.signal,
        }),
        // Le mode `fixture` court-circuite l'appel réseau, et lui seul. En
        // mode `api`, aucun repli n'est prévu : un échec reste un échec.
        source === "fixture"
          ? Promise.resolve(buildDemoPrediction(currentSiteId, endTime))
          : fetchPredictions({
              client: getApiClient(),
              siteId: currentSiteId,
              startTime: forecast.startTime,
              endTime: forecast.endTime,
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

    void load(siteId, predictionSource);

    return () => {
      active = false;
      controller.abort();
    };
  }, [siteId, predictionSource, startTimeRequested, endTimeRequested]);

  // Les données ne sont exposées que si elles proviennent bien du site demandé.
  const isCurrent = siteId !== null && loaded.siteId === siteId;
  const applied =
    startTimeRequested !== null && endTimeRequested !== null
      ? { startTime: startTimeRequested, endTime: endTimeRequested }
      : null;

  return {
    points: isCurrent ? loaded.points : [],
    prediction: isCurrent ? loaded.prediction : null,
    readingsError: isCurrent ? loaded.readingsError : null,
    predictionError: isCurrent ? loaded.predictionError : null,
    isLoading: siteId !== null && !isCurrent,
    windowHours: applied === null ? DEFAULT_WINDOW_HOURS : Math.round(windowHours(applied)),
    window: applied ?? recentWindow(new Date(), DEFAULT_WINDOW_HOURS),
    predictionSource,
  };
}
