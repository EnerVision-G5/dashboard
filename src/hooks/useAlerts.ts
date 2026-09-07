/**
 * Alertes du site affiché, rafraîchies en continu (EV-17).
 *
 * Le ticket demande un rafraîchissement automatique, et c'est le seul flux du
 * dashboard où il compte vraiment : une alerte n'a d'intérêt que si elle
 * apparaît sans qu'on ait rechargé la page. Trente secondes, comme le panneau
 * temps réel — la collecte écrit une mesure par minute, et une alerte naît de
 * cette écriture.
 *
 * La fenêtre lue accompagne l'écran : les alertes affichées sont celles de la
 * période que le graphique montre, pas tout l'historique du site. Sans cette
 * borne, un site ayant connu cent incidents en trois mois noierait celui de
 * cette nuit.
 */

import { useEffect, useState } from "react";
import type { Alert } from "../api/alerts";
import { fetchAlerts } from "../api/alerts";
import { getApiClient } from "../api/clients";
import { isCancellation } from "../api/http";
import { DEFAULT_WINDOW_HOURS, recentWindow } from "../lib/timeWindow";

/** Période de rafraîchissement des alertes. */
export const ALERTS_REFRESH_INTERVAL_MS = 30_000;

/** Profondeur de la fenêtre lue, en heures. */
export const ALERTS_WINDOW_HOURS = DEFAULT_WINDOW_HOURS;

/** État exposé par `useAlerts`. */
export interface AlertsState {
  /** Alertes du site demandé, les plus graves d'abord. */
  alerts: Alert[];
  /** Vrai tant que la première réponse du site demandé n'est pas arrivée. */
  isLoading: boolean;
  /** Erreur du flux, `null` s'il a abouti. */
  error: string | null;
  /** Profondeur de la fenêtre lue, pour que l'écran puisse le dire. */
  windowHours: number;
}

interface LoadedState {
  siteId: string | null;
  alerts: Alert[];
  error: string | null;
}

const EMPTY: LoadedState = { siteId: null, alerts: [], error: null };

export function useAlerts(siteId: string | null): AlertsState {
  const [loaded, setLoaded] = useState<LoadedState>(EMPTY);

  useEffect(() => {
    if (siteId === null) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function load(currentSiteId: string): Promise<void> {
      // La fenêtre est recalculée à chaque passage : elle doit glisser avec
      // l'horloge, sinon le bord ancien de la fenêtre resterait figé à
      // l'ouverture de la page.
      const { startTime, endTime } = recentWindow(new Date(), ALERTS_WINDOW_HOURS);
      try {
        const alerts = await fetchAlerts({
          client: getApiClient(),
          siteId: currentSiteId,
          startTime,
          endTime,
          signal: controller.signal,
        });
        if (active) {
          setLoaded({ siteId: currentSiteId, alerts, error: null });
        }
      } catch (caught) {
        if (!active || isCancellation(caught)) {
          return;
        }
        // Les alertes précédentes sont effacées avec l'erreur : laisser à
        // l'écran une liste dont on ne sait plus si elle est à jour serait
        // pire que de dire qu'on ne sait pas.
        setLoaded({
          siteId: currentSiteId,
          alerts: [],
          error: caught instanceof Error ? caught.message : String(caught),
        });
      }
    }

    void load(siteId);
    const timer = setInterval(() => {
      void load(siteId);
    }, ALERTS_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
      controller.abort();
    };
  }, [siteId]);

  const isCurrent = siteId !== null && loaded.siteId === siteId;

  return {
    alerts: isCurrent ? loaded.alerts : [],
    error: isCurrent ? loaded.error : null,
    isLoading: siteId !== null && !isCurrent,
    windowHours: ALERTS_WINDOW_HOURS,
  };
}
