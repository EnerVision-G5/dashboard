/**
 * Diagnostics du site affiché : ingestion, écart prédiction/réel, pannes de
 * capteur (EV-52).
 *
 * Deux lectures du contrat 1.5.0, sur le site sélectionné :
 *   - `GET /sites/{id}/indicators` sert la fraîcheur d'ingestion, l'état du
 *     collecteur et l'écart entre les prévisions servies et le réel ;
 *   - `GET /sites/{id}/sensors/history` sert les épisodes de panne, avec leur
 *     début, leur fin et le capteur concerné.
 *
 * Le bandeau d'EV-18 interroge déjà `/indicators` pour le parc entier. La
 * route par site est préférée ici plutôt que de réutiliser cette liste : les
 * deux écrans n'ont pas la même granularité — l'un veut sept synthèses, l'autre
 * le détail d'un site — et surtout la route par site renvoie un 404 sur un
 * site inconnu, là où la liste du parc laisserait une absence muette.
 *
 * Comme partout ailleurs, les deux flux échouent indépendamment : un
 * historique de pannes indisponible n'efface pas une fraîcheur correctement
 * lue.
 */

import { useEffect, useState } from "react";
import type { SiteIndicators } from "../api/indicators";
import type { SensorFailure } from "../api/sensors";
import { fetchSiteIndicators } from "../api/indicators";
import { fetchSensorHistory } from "../api/sensors";
import { getApiClient } from "../api/clients";
import { isCancellation } from "../api/http";

/**
 * Période de rafraîchissement.
 *
 * Alignée sur celle du bandeau d'EV-18 : les deux lisent les mêmes
 * indicateurs, les voir se contredire d'une demi-minute sur le même écran
 * serait incompréhensible.
 */
export const DIAGNOSTICS_REFRESH_INTERVAL_MS = 60_000;

/** État exposé par `useSiteDiagnostics`. */
export interface SiteDiagnosticsState {
  /** Indicateurs du site affiché, `null` tant que rien n'est arrivé. */
  indicators: SiteIndicators | null;
  /** Épisodes de panne de capteur, le plus récent d'abord. */
  failures: SensorFailure[];
  /** Vrai tant que la première réponse n'est pas arrivée. */
  isLoading: boolean;
  /** Erreur du flux des indicateurs, `null` s'il a abouti. */
  indicatorsError: string | null;
  /** Erreur du flux de l'historique, `null` s'il a abouti. */
  failuresError: string | null;
}

interface LoadedState {
  siteId: string | null;
  indicators: SiteIndicators | null;
  failures: SensorFailure[];
  indicatorsError: string | null;
  failuresError: string | null;
}

const EMPTY: LoadedState = {
  siteId: null,
  indicators: null,
  failures: [],
  indicatorsError: null,
  failuresError: null,
};

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function useSiteDiagnostics(siteId: string | null): SiteDiagnosticsState {
  const [loaded, setLoaded] = useState<LoadedState>(EMPTY);

  useEffect(() => {
    if (siteId === null) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function load(currentSiteId: string): Promise<void> {
      const client = getApiClient();
      const [indicators, failures] = await Promise.allSettled([
        fetchSiteIndicators({ client, siteId: currentSiteId, signal: controller.signal }),
        fetchSensorHistory(client, currentSiteId, controller.signal),
      ]);

      if (!active) {
        return;
      }
      if (
        (indicators.status === "rejected" && isCancellation(indicators.reason)) ||
        (failures.status === "rejected" && isCancellation(failures.reason))
      ) {
        return;
      }

      setLoaded({
        siteId: currentSiteId,
        indicators: indicators.status === "fulfilled" ? indicators.value : null,
        failures: failures.status === "fulfilled" ? failures.value : [],
        indicatorsError:
          indicators.status === "rejected" ? messageOf(indicators.reason) : null,
        failuresError: failures.status === "rejected" ? messageOf(failures.reason) : null,
      });
    }

    void load(siteId);
    const timer = setInterval(() => {
      void load(siteId);
    }, DIAGNOSTICS_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
      controller.abort();
    };
  }, [siteId]);

  // Rien n'est exposé sous le nom d'un autre site : pendant un changement de
  // site, l'état précédent est tenu pour absent.
  const isCurrent = siteId !== null && loaded.siteId === siteId;

  return {
    indicators: isCurrent ? loaded.indicators : null,
    failures: isCurrent ? loaded.failures : [],
    indicatorsError: isCurrent ? loaded.indicatorsError : null,
    failuresError: isCurrent ? loaded.failuresError : null,
    isLoading: siteId !== null && !isCurrent,
  };
}
